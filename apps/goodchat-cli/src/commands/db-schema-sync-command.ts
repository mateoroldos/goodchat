import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { databaseDialectSchema } from "@goodchat/contracts/config/models";
import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import { createJiti } from "jiti";
import z from "zod";

export interface DbSchemaSyncOptions {
  check: boolean;
  configPath?: string;
  cwd: string;
  dialect?: string;
}

const GOODCHAT_CONFIG_PATH = "src/goodchat.ts";
const DIALECT_REGEX = /dialect\s*:\s*"(sqlite|postgres|mysql)"/;
const AUTH_ENABLED_REGEX = /auth\s*:\s*\{[\s\S]*?enabled\s*:\s*(true|false)/;
const CORE_SCHEMA_EXPORT_REGEX =
  /export const (sqliteSchema|postgresSchema|mysqlSchema)\s*=/;
const requireFromCli = createRequire(import.meta.url);

const readTextFileOrNull = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const ensureParentDirectory = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

const resolveConfigPath = (cwd: string, configPath: string): string => {
  if (isAbsolute(configPath)) {
    return configPath;
  }
  return join(cwd, configPath);
};

const resolvePackageRootOrNull = (
  resolvePackageJsonPath: () => string
): string | null => {
  try {
    const packageJsonPath = resolvePackageJsonPath();
    return dirname(packageJsonPath);
  } catch {
    return null;
  }
};

const resolveTemplatesPackageRoot = (cwd: string): string | null => {
  const requireFromProject = createRequire(join(cwd, "package.json"));
  const projectPackageRoot = resolvePackageRootOrNull(() =>
    requireFromProject.resolve("@goodchat/templates/package.json")
  );
  if (projectPackageRoot) {
    return projectPackageRoot;
  }

  const projectSchemaEntryPath = resolvePackageRootOrNull(() =>
    requireFromProject.resolve("@goodchat/templates/schema/sqlite")
  );
  if (projectSchemaEntryPath) {
    return resolve(projectSchemaEntryPath, "..");
  }

  const cliPackageRoot = resolvePackageRootOrNull(() =>
    requireFromCli.resolve("@goodchat/templates/package.json")
  );
  if (cliPackageRoot) {
    return cliPackageRoot;
  }

  const cliSchemaEntryPath = resolvePackageRootOrNull(() =>
    requireFromCli.resolve("@goodchat/templates/schema/sqlite")
  );
  if (cliSchemaEntryPath) {
    return resolve(cliSchemaEntryPath, "..");
  }

  return null;
};

const readCoreSchemaTemplate = async (input: {
  cwd: string;
  relativePath: string;
}): Promise<string> => {
  const corePackageRoot = resolveTemplatesPackageRoot(input.cwd);
  if (corePackageRoot) {
    const candidatePath = resolve(corePackageRoot, input.relativePath);
    const content = await readTextFileOrNull(candidatePath);
    if (content !== null) {
      return content;
    }
  }

  throw new Error(
    `Could not load schema template from @goodchat/templates (${input.relativePath}). Ensure @goodchat/templates is installed.`
  );
};

interface LoadedGoodchatConfig {
  auth?: unknown;
  database?: {
    dialect?: unknown;
  };
}

const parseGoodchatConfigFromSource = (
  source: string
): LoadedGoodchatConfig | null => {
  const dialectMatch = source.match(DIALECT_REGEX);
  if (!dialectMatch) {
    return null;
  }

  const authEnabledMatch = source.match(AUTH_ENABLED_REGEX);
  const authEnabled = authEnabledMatch?.[1] === "true";

  return {
    database: {
      dialect: dialectMatch[1],
    },
    auth: {
      enabled: authEnabled,
      localChatPublic: false,
      mode: "password",
      password: authEnabled ? "__inferred__" : undefined,
    },
  };
};

const authConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: z.literal("password").default("password"),
    localChatPublic: z.boolean().default(false),
    password: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (!value.enabled) {
      return;
    }

    if (!value.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Auth password is required when auth is enabled",
      });
    }
  });

const loadGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<LoadedGoodchatConfig> => {
  const configPath = resolveConfigPath(input.cwd, input.configPath);
  const content = await readTextFileOrNull(configPath);
  if (!content) {
    throw new Error(`Missing ${input.configPath}.`);
  }

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false,
  });

  try {
    const moduleExports = (await jiti.import(configPath)) as {
      goodchat?: LoadedGoodchatConfig;
    };

    return moduleExports.goodchat ?? {};
  } catch (error) {
    const inferredConfig = parseGoodchatConfigFromSource(content);
    if (inferredConfig) {
      return inferredConfig;
    }

    throw error;
  }
};

const resolveDialectFromGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<DatabaseDialect> => {
  const moduleExports = await loadGoodchatConfig(input);
  const parsedDialect = databaseDialectSchema.safeParse(
    moduleExports.database?.dialect
  );
  if (parsedDialect.success) {
    return parsedDialect.data;
  }

  throw new Error(
    `Could not resolve a valid database dialect from ${input.configPath}. Export goodchat.database with a supported dialect.`
  );
};

const resolveAuthEnabledFromGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<boolean> => {
  const moduleExports = await loadGoodchatConfig(input);
  const parsedAuth = authConfigSchema.safeParse(moduleExports.auth ?? {});

  if (!parsedAuth.success) {
    const auth = moduleExports.auth;
    if (
      typeof auth === "object" &&
      auth !== null &&
      "enabled" in auth &&
      typeof auth.enabled === "boolean"
    ) {
      return auth.enabled;
    }

    throw new Error(
      `Could not resolve a valid auth config from ${input.configPath}. Export goodchat.auth with a supported auth shape.`
    );
  }

  return parsedAuth.data.enabled;
};

const resolveDialect = (options: {
  configPath: string;
  cwd: string;
  dialect?: string;
}): Promise<DatabaseDialect> => {
  if (options.dialect) {
    const parsed = databaseDialectSchema.safeParse(options.dialect);
    if (!parsed.success) {
      throw new Error(
        `Invalid --dialect value: ${options.dialect}. Expected one of sqlite, postgres, mysql.`
      );
    }
    return Promise.resolve(parsed.data);
  }

  return resolveDialectFromGoodchatConfig({
    configPath: options.configPath,
    cwd: options.cwd,
  });
};

const getDrizzleDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "postgresql";
  }
  return dialect;
};

const renderDrizzleCredentials = (dialect: DatabaseDialect): string => {
  if (dialect === "sqlite") {
    return '    url: process.env.DATABASE_URL || "./goodchat.db",';
  }
  return '    url: process.env.DATABASE_URL || "",';
};

const renderCoreSchemaFile = async (input: {
  cwd: string;
  dialect: DatabaseDialect;
}): Promise<string> => {
  const schemaPathByDialect = {
    mysql: "schema/mysql.ts",
    postgres: "schema/postgres.ts",
    sqlite: "schema/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  const template = await readCoreSchemaTemplate({
    cwd: input.cwd,
    relativePath: schemaPathByDialect[input.dialect],
  });

  return template.replace(
    CORE_SCHEMA_EXPORT_REGEX,
    "export const coreSchema ="
  );
};

const renderAuthSchemaFile = (input: {
  authEnabled: boolean;
  cwd: string;
  dialect: DatabaseDialect;
}): Promise<string> => {
  if (!input.authEnabled) {
    return Promise.resolve("export const authSchema = {};\n");
  }

  const authSchemaPathByDialect = {
    mysql: "schema/auth/mysql.ts",
    postgres: "schema/auth/postgres.ts",
    sqlite: "schema/auth/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  return readCoreSchemaTemplate({
    cwd: input.cwd,
    relativePath: authSchemaPathByDialect[input.dialect],
  });
};

const renderComposedSchemaFile = (): string => {
  return `import { authSchema } from "./auth-schema";
import { coreSchema } from "./core-schema";
import { pluginSchema } from "./plugins/schema";

// biome-ignore lint/performance/noBarrelFile: drizzle-kit relies on exported table symbols
export * from "./auth-schema";
export * from "./core-schema";
export * from "./plugins/schema";

export const schema = {
  ...coreSchema,
  ...authSchema,
  ...pluginSchema,
};
`;
};

const renderDbSchemaArtifacts = async (input: {
  authEnabled: boolean;
  cwd: string;
  dialect: DatabaseDialect;
}): Promise<Record<string, string>> => {
  const [coreSchema, authSchema] = await Promise.all([
    renderCoreSchemaFile({ cwd: input.cwd, dialect: input.dialect }),
    renderAuthSchemaFile({
      authEnabled: input.authEnabled,
      cwd: input.cwd,
      dialect: input.dialect,
    }),
  ]);

  return {
    "drizzle.config.ts": `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${getDrizzleDialect(input.dialect)}",
  dbCredentials: {
${renderDrizzleCredentials(input.dialect)}
  },
});
`,
    "src/db/core-schema.ts": coreSchema,
    "src/db/schema.ts": renderComposedSchemaFile(),
    "src/db/auth-schema.ts": authSchema,
    "src/db/plugins/schema.ts": "export const pluginSchema = {};\n",
  };
};

export const runDbSchemaSync = async (
  options: DbSchemaSyncOptions
): Promise<void> => {
  const configPath = options.configPath ?? GOODCHAT_CONFIG_PATH;
  const dialect = await resolveDialect({
    dialect: options.dialect,
    configPath,
    cwd: options.cwd,
  });
  const authEnabled = await resolveAuthEnabledFromGoodchatConfig({
    configPath,
    cwd: options.cwd,
  });
  const expectedFiles = await renderDbSchemaArtifacts({
    authEnabled,
    cwd: options.cwd,
    dialect,
  });

  const existingFiles = await Promise.all(
    Object.keys(expectedFiles).map(async (path) => {
      const absolutePath = join(options.cwd, path);
      const content = await readTextFileOrNull(absolutePath);
      return { content, path };
    })
  );

  const driftErrors: string[] = [];
  for (const file of existingFiles) {
    const expectedContent =
      expectedFiles[file.path as keyof typeof expectedFiles];
    if (file.content !== expectedContent) {
      driftErrors.push(
        `${file.path} is out of date. Run: goodchat db schema sync`
      );
    }
  }

  if (options.check) {
    if (driftErrors.length > 0) {
      throw new Error(driftErrors.join("\n"));
    }
    return;
  }

  for (const [path, content] of Object.entries(expectedFiles)) {
    const absolutePath = join(options.cwd, path);
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, content, "utf8");
  }
};
