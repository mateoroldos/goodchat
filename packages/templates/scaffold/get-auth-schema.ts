import { AUTH_SCHEMA_TEMPLATE_BY_DIALECT } from "./generated/db-schema-templates";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

interface AuthSchemaProvider {
  getSchema: (dialect: DatabaseDialect) => string;
}

const generatedAuthSchemaProvider: AuthSchemaProvider = {
  getSchema: (dialect) => AUTH_SCHEMA_TEMPLATE_BY_DIALECT[dialect],
};

export const getAuthSchema = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
}): string => {
  return generatedAuthSchemaProvider.getSchema(input.dialect);
};
