import {
  AUTH_SCHEMA_TEMPLATE_BY_DIALECT,
  CORE_SCHEMA_TEMPLATE_BY_DIALECT,
} from "./generated/db-schema-templates";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

const USER_MANAGED_PLUGIN_SCHEMA = `// User-managed plugin schema file.
// Add plugin table exports here and merge them into pluginSchema.
export const pluginSchema = {};
`;

const CORE_SCHEMA_EXPORT_REGEX =
  /export const (sqliteSchema|postgresSchema|mysqlSchema)\s*=/;

const TEMPLATE_BY_RELATIVE_PATH = {
  "schema/auth/mysql.ts": AUTH_SCHEMA_TEMPLATE_BY_DIALECT.mysql,
  "schema/auth/postgres.ts": AUTH_SCHEMA_TEMPLATE_BY_DIALECT.postgres,
  "schema/auth/sqlite.ts": AUTH_SCHEMA_TEMPLATE_BY_DIALECT.sqlite,
  "schema/mysql.ts": CORE_SCHEMA_TEMPLATE_BY_DIALECT.mysql,
  "schema/postgres.ts": CORE_SCHEMA_TEMPLATE_BY_DIALECT.postgres,
  "schema/sqlite.ts": CORE_SCHEMA_TEMPLATE_BY_DIALECT.sqlite,
} as const;

export const readSchemaTemplate = (input: {
  relativePath: string;
  cwd?: string;
}): Promise<string> => {
  const template =
    TEMPLATE_BY_RELATIVE_PATH[
      input.relativePath as keyof typeof TEMPLATE_BY_RELATIVE_PATH
    ];
  if (template) {
    return Promise.resolve(template);
  }

  return Promise.reject(
    new Error(
      `Could not load schema template from @goodchat/templates (${input.relativePath}). Ensure @goodchat/templates includes this asset.`
    )
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
    return "    url: process.env.DATABASE_URL,";
  }
  return "    url: process.env.DATABASE_URL,";
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
    "src/db/plugins/schema.ts": USER_MANAGED_PLUGIN_SCHEMA,
  };
};
