import type {
  MysqlMessagesTable,
  PostgresMessagesTable,
  SqliteMessagesTable,
} from "./messages-table";
import { defineMessagesTable } from "./messages-table";
import type {
  MysqlMetaTable,
  PostgresMetaTable,
  SqliteMetaTable,
} from "./meta-table";
import { defineMetaTable } from "./meta-table";
import type { SchemaDialect } from "./schema-types";
import type {
  MysqlThreadsTable,
  PostgresThreadsTable,
  SqliteThreadsTable,
} from "./threads-table";
import { defineThreadsTable } from "./threads-table";

export const SCHEMA_VERSION = "2026-03-31";

export interface PostgresSchema {
  goodchatMeta: PostgresMetaTable;
  messages: PostgresMessagesTable;
  threads: PostgresThreadsTable;
}

export interface SqliteSchema {
  goodchatMeta: SqliteMetaTable;
  messages: SqliteMessagesTable;
  threads: SqliteThreadsTable;
}

export interface MysqlSchema {
  goodchatMeta: MysqlMetaTable;
  messages: MysqlMessagesTable;
  threads: MysqlThreadsTable;
}

export function defineSchema(dialect: "postgres"): PostgresSchema;
export function defineSchema(dialect: "sqlite"): SqliteSchema;
export function defineSchema(dialect: "mysql"): MysqlSchema;
export function defineSchema(dialect: SchemaDialect) {
  if (dialect === "postgres") {
    return {
      threads: defineThreadsTable("postgres"),
      messages: defineMessagesTable("postgres"),
      goodchatMeta: defineMetaTable("postgres"),
    };
  }

  if (dialect === "sqlite") {
    return {
      threads: defineThreadsTable("sqlite"),
      messages: defineMessagesTable("sqlite"),
      goodchatMeta: defineMetaTable("sqlite"),
    };
  }

  return {
    threads: defineThreadsTable("mysql"),
    messages: defineMessagesTable("mysql"),
    goodchatMeta: defineMetaTable("mysql"),
  };
}

export type { SchemaDialect } from "./schema-types";

export const postgresSchema = defineSchema("postgres");
export const sqliteSchema = defineSchema("sqlite");
export const mysqlSchema = defineSchema("mysql");
