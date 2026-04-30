import {
  emitAuthDrizzleSchema,
  emitCoreDrizzleSchema,
} from "./schema-foundation";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

const CORE_SCHEMA_EXPORT_REGEX =
  /export const (sqliteSchema|postgresSchema|mysqlSchema)\s*=/;

const getDrizzleDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "postgresql";
  }
  return dialect;
};

const renderCoreSchemaFile = (dialect: DatabaseDialect): string => {
  return emitCoreDrizzleSchema(dialect).replace(
    CORE_SCHEMA_EXPORT_REGEX,
    "export const coreSchema ="
  );
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
  cwd?: string;
  dialect: DatabaseDialect;
}): Promise<Record<string, string>> => {
  const [coreSchema, authSchema] = await Promise.all([
    Promise.resolve(renderCoreSchemaFile(input.dialect)),
    Promise.resolve(emitAuthDrizzleSchema(input.dialect)),
  ]);

  return {
    "drizzle.config.ts": `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${getDrizzleDialect(input.dialect)}",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
`,
    "src/db/core-schema.ts": coreSchema,
    "src/db/schema.ts": renderComposedSchemaFile(),
    "src/db/auth-schema.ts": authSchema,
    "src/db/plugins/schema.ts": "export const pluginSchema = {};\n",
  };
};
