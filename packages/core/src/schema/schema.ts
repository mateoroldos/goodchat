import { defineMessagesTable } from "./messages-table";
import { defineMetaTable } from "./meta-table";
import type { SchemaDialect } from "./schema-types";
import { defineThreadsTable } from "./threads-table";

export const SCHEMA_VERSION = "2026-03-31";

export const defineSchema = (dialect: SchemaDialect) => {
  return {
    threads: defineThreadsTable(dialect),
    messages: defineMessagesTable(dialect),
    goodchatMeta: defineMetaTable(dialect),
  };
};

export type { SchemaDialect } from "./schema-types";

export const postgresSchema = defineSchema("postgres");
export const sqliteSchema = defineSchema("sqlite");
export const mysqlSchema = defineSchema("mysql");
