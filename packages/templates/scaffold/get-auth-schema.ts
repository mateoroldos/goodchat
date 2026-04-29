import { AUTH_SCHEMA_TEMPLATE_BY_DIALECT } from "./generated/db-schema-templates";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

interface AuthSchemaProvider {
  getSchema: (dialect: DatabaseDialect) => string;
}

const DRIZZLE_MODULE_BY_DIALECT: Record<DatabaseDialect, string> = {
  sqlite: "drizzle-orm/sqlite-core",
  postgres: "drizzle-orm/pg-core",
  mysql: "drizzle-orm/mysql-core",
};

const generatedAuthSchemaProvider: AuthSchemaProvider = {
  getSchema: (dialect) => AUTH_SCHEMA_TEMPLATE_BY_DIALECT[dialect],
};

export const getAuthSchema = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
}): string => {
  if (!input.authEnabled) {
    return `import {} from "${DRIZZLE_MODULE_BY_DIALECT[input.dialect]}";\n\nexport const authSchema = {};\n`;
  }

  return generatedAuthSchemaProvider.getSchema(input.dialect);
};
