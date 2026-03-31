import {
  json as mysqlJson,
  mysqlTable,
  text as mysqlText,
  varchar as mysqlVarchar,
} from "drizzle-orm/mysql-core";
import { jsonb, pgTable, text as pgText } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import type { SchemaDialect } from "./schema-types";

const definePostgresMessagesTable = () =>
  pgTable("goodchat_messages", {
    id: pgText("id").primaryKey(),
    threadId: pgText("thread_id").notNull(),
    role: pgText("role"),
    text: pgText("text").notNull(),
    createdAt: pgText("created_at").notNull(),
    metadata: jsonb("metadata"),
    userId: pgText("user_id").notNull(),
    adapterName: pgText("adapter_name").notNull(),
  });

const defineSqliteMessagesTable = () =>
  sqliteTable("goodchat_messages", {
    id: sqliteText("id").primaryKey(),
    threadId: sqliteText("thread_id").notNull(),
    role: sqliteText("role"),
    text: sqliteText("text").notNull(),
    createdAt: sqliteText("created_at").notNull(),
    metadata: sqliteText("metadata", { mode: "json" }),
    userId: sqliteText("user_id").notNull(),
    adapterName: sqliteText("adapter_name").notNull(),
  });

const defineMysqlMessagesTable = () =>
  mysqlTable("goodchat_messages", {
    id: mysqlVarchar("id", { length: 191 }).primaryKey(),
    threadId: mysqlText("thread_id").notNull(),
    role: mysqlText("role"),
    text: mysqlText("text").notNull(),
    createdAt: mysqlText("created_at").notNull(),
    metadata: mysqlJson("metadata"),
    userId: mysqlText("user_id").notNull(),
    adapterName: mysqlText("adapter_name").notNull(),
  });

export type PostgresMessagesTable = ReturnType<
  typeof definePostgresMessagesTable
>;
export type SqliteMessagesTable = ReturnType<typeof defineSqliteMessagesTable>;
export type MysqlMessagesTable = ReturnType<typeof defineMysqlMessagesTable>;

export function defineMessagesTable(dialect: "postgres"): PostgresMessagesTable;
export function defineMessagesTable(dialect: "sqlite"): SqliteMessagesTable;
export function defineMessagesTable(dialect: "mysql"): MysqlMessagesTable;
export function defineMessagesTable(dialect: SchemaDialect) {
  if (dialect === "postgres") {
    return definePostgresMessagesTable();
  }

  if (dialect === "sqlite") {
    return defineSqliteMessagesTable();
  }

  return defineMysqlMessagesTable();
}
