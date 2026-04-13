import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

const CORE_SCHEMA_EXPORT_REGEX =
  /export const (sqliteSchema|postgresSchema|mysqlSchema)\s*=/;
const requireFromTemplates = createRequire(import.meta.url);

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

export const resolveTemplatesPackageRoot = (cwd?: string): string | null => {
  if (cwd) {
    const requireFromProject = createRequire(resolve(cwd, "package.json"));

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
  }

  const packageRoot = resolvePackageRootOrNull(() =>
    requireFromTemplates.resolve("@goodchat/templates/package.json")
  );
  if (packageRoot) {
    return packageRoot;
  }

  const schemaEntryPath = resolvePackageRootOrNull(() =>
    requireFromTemplates.resolve("@goodchat/templates/schema/sqlite")
  );
  if (schemaEntryPath) {
    return resolve(schemaEntryPath, "..");
  }

  return null;
};

export const readSchemaTemplate = async (input: {
  relativePath: string;
  cwd?: string;
}): Promise<string> => {
  const templatesPackageRoot = resolveTemplatesPackageRoot(input.cwd);
  if (templatesPackageRoot) {
    const candidatePath = resolve(templatesPackageRoot, input.relativePath);
    const content = await readTextFileOrNull(candidatePath);
    if (content !== null) {
      return content;
    }
  }

  throw new Error(
    `Could not load schema template from @goodchat/templates (${input.relativePath}). Ensure @goodchat/templates is installed.`
  );
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
  dialect: DatabaseDialect;
  cwd?: string;
}): Promise<string> => {
  const schemaPathByDialect = {
    mysql: "schema/mysql.ts",
    postgres: "schema/postgres.ts",
    sqlite: "schema/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  const template = await readSchemaTemplate({
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
  dialect: DatabaseDialect;
  cwd?: string;
}): Promise<string> => {
  if (!input.authEnabled) {
    return Promise.resolve("export const authSchema = {};\n");
  }

  const authSchemaPathByDialect = {
    mysql: "schema/auth/mysql.ts",
    postgres: "schema/auth/postgres.ts",
    sqlite: "schema/auth/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  return readSchemaTemplate({
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

export const renderDbSchemaArtifacts = async (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
  cwd?: string;
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
