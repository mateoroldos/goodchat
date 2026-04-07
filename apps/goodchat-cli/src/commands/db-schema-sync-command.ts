import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { databaseDialectSchema } from "@goodchat/contracts/config/models";
import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import { createJiti } from "jiti";

export interface DbSchemaSyncOptions {
  check: boolean;
  configPath?: string;
  cwd: string;
  dialect?: string;
}

const DRIZZLE_CONFIG_PATH = "drizzle.config.ts";
const GOODCHAT_CONFIG_PATH = "src/goodchat.ts";
const COMPOSED_SCHEMA_PATH = "src/db/schema.ts";
const AUTH_SCHEMA_PATH = "src/db/auth-schema.ts";
const PLUGIN_SCHEMA_PATH = "src/db/plugins/schema.ts";

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

const resolveDialectFromGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<DatabaseDialect> => {
  const configPath = resolveConfigPath(input.cwd, input.configPath);
  const content = await readTextFileOrNull(configPath);
  if (!content) {
    throw new Error(`Missing ${input.configPath}.`);
  }

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false,
  });

  const moduleExports = (await jiti.import(configPath)) as {
    goodchat?: { database?: { dialect?: unknown } };
  };
  const parsedDialect = databaseDialectSchema.safeParse(
    moduleExports.goodchat?.database?.dialect
  );
  if (parsedDialect.success) {
    return parsedDialect.data;
  }

  throw new Error(
    `Could not resolve a valid database dialect from ${input.configPath}. Export goodchat.database with a supported dialect.`
  );
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

const renderDrizzleConfigFile = (dialect: DatabaseDialect): string => {
  return `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${getDrizzleDialect(dialect)}",
  dbCredentials: {
${renderDrizzleCredentials(dialect)}
  },
});
`;
};

const getCoreSchemaImportForDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "@goodchat/core/schema/postgres";
  }
  if (dialect === "mysql") {
    return "@goodchat/core/schema/mysql";
  }
  return "@goodchat/core/schema/sqlite";
};

const getCoreSchemaExportNameForDialect = (
  dialect: DatabaseDialect
): string => {
  if (dialect === "postgres") {
    return "postgresSchema";
  }
  if (dialect === "mysql") {
    return "mysqlSchema";
  }
  return "sqliteSchema";
};

const renderComposedSchemaFile = (dialect: DatabaseDialect): string => {
  const importPath = getCoreSchemaImportForDialect(dialect);
  const schemaExportName = getCoreSchemaExportNameForDialect(dialect);
  return `import { ${schemaExportName} as goodchatSchema } from "${importPath}";
import { authSchema } from "./auth-schema";
import { pluginSchema } from "./plugins/schema";

export const schema = {
  ...goodchatSchema,
  ...authSchema,
  ...pluginSchema,
};
`;
};

const renderAuthSchemaFile = (): string => {
  return `export const authSchema = {};
`;
};

const renderPluginSchemaFile = (): string => {
  return `export const pluginSchema = {};
`;
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
  const expectedFiles = {
    [DRIZZLE_CONFIG_PATH]: renderDrizzleConfigFile(dialect),
    [COMPOSED_SCHEMA_PATH]: renderComposedSchemaFile(dialect),
    [AUTH_SCHEMA_PATH]: renderAuthSchemaFile(),
    [PLUGIN_SCHEMA_PATH]: renderPluginSchemaFile(),
  };

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
