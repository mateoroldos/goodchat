import type { GoodchatPluginSchema } from "@goodchat/contracts/db/types";
import { generateDrizzleSchema } from "@goodchat/core/db/drizzle-generator";
import { getGoodchatTables } from "@goodchat/core/db/get-tables";
import { AUTH_SCHEMA_TEMPLATE_BY_DIALECT } from "./generated/db-schema-templates";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

const FIRST_IMPORT = /^import\s+\{[\s\S]*?\}\s+from\s+"[^"]+";\n\n/;

const DIALECT_IMPORTS: Record<DatabaseDialect, string> = {
  sqlite: `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";`,
  postgres: `import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";`,
  mysql: `import { boolean, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";`,
};

const getDrizzleDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "postgresql";
  }
  return dialect;
};

const renderAuthSchemaFile = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
}): string => {
  if (!input.authEnabled) {
    return "export const authSchema = {};\n";
  }
  return AUTH_SCHEMA_TEMPLATE_BY_DIALECT[input.dialect];
};

const renderUnifiedSchemaFile = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
  plugins?: Array<{ schema?: GoodchatPluginSchema }>;
}): string => {
  const merged = getGoodchatTables(input.plugins ?? []);
  const generatedCoreAndPluginSchema = generateDrizzleSchema(
    merged,
    input.dialect,
    "coreSchema",
    false
  ).trimEnd();
  const authSchema = renderAuthSchemaFile(input)
    .replace(FIRST_IMPORT, "")
    .trimEnd();
  const importLine = DIALECT_IMPORTS[input.dialect];

  return `${importLine}\n\n${authSchema}\n\n${generatedCoreAndPluginSchema}\n\nexport const schema = {\n  ...authSchema,\n  ...coreSchema,\n};\n`;
};

export const renderDbSchemaArtifacts = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
  plugins?: Array<{ schema?: GoodchatPluginSchema }>;
  cwd?: string;
}): Promise<Record<string, string>> => {
  return Promise.resolve({
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
    "src/db/schema.ts": renderUnifiedSchemaFile(input),
  });
};
