import {
  mysqlTable,
  text as mysqlText,
  varchar as mysqlVarchar,
} from "drizzle-orm/mysql-core";
import { pgTable, text as pgText } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import type { SchemaDialect } from "./schema-types";

const definePostgresThreadsTable = () =>
  pgTable("goodchat_threads", {
    id: pgText("id").primaryKey(),
    botId: pgText("bot_id").notNull(),
    botName: pgText("bot_name").notNull(),
    platform: pgText("platform").notNull(),
    adapterName: pgText("adapter_name").notNull(),
    threadId: pgText("thread_id").notNull(),
    userId: pgText("user_id").notNull(),
    text: pgText("text").notNull(),
    responseText: pgText("response_text").notNull(),
    createdAt: pgText("created_at").notNull(),
    updatedAt: pgText("updated_at").notNull(),
    lastActivityAt: pgText("last_activity_at").notNull(),
  });

const defineSqliteThreadsTable = () =>
  sqliteTable("goodchat_threads", {
    id: sqliteText("id").primaryKey(),
    botId: sqliteText("bot_id").notNull(),
    botName: sqliteText("bot_name").notNull(),
    platform: sqliteText("platform").notNull(),
    adapterName: sqliteText("adapter_name").notNull(),
    threadId: sqliteText("thread_id").notNull(),
    userId: sqliteText("user_id").notNull(),
    text: sqliteText("text").notNull(),
    responseText: sqliteText("response_text").notNull(),
    createdAt: sqliteText("created_at").notNull(),
    updatedAt: sqliteText("updated_at").notNull(),
    lastActivityAt: sqliteText("last_activity_at").notNull(),
  });

const defineMysqlThreadsTable = () =>
  mysqlTable("goodchat_threads", {
    id: mysqlVarchar("id", { length: 191 }).primaryKey(),
    botId: mysqlText("bot_id").notNull(),
    botName: mysqlText("bot_name").notNull(),
    platform: mysqlText("platform").notNull(),
    adapterName: mysqlText("adapter_name").notNull(),
    threadId: mysqlText("thread_id").notNull(),
    userId: mysqlText("user_id").notNull(),
    text: mysqlText("text").notNull(),
    responseText: mysqlText("response_text").notNull(),
    createdAt: mysqlText("created_at").notNull(),
    updatedAt: mysqlText("updated_at").notNull(),
    lastActivityAt: mysqlText("last_activity_at").notNull(),
  });

export type PostgresThreadsTable = ReturnType<
  typeof definePostgresThreadsTable
>;
export type SqliteThreadsTable = ReturnType<typeof defineSqliteThreadsTable>;
export type MysqlThreadsTable = ReturnType<typeof defineMysqlThreadsTable>;

export function defineThreadsTable(dialect: "postgres"): PostgresThreadsTable;
export function defineThreadsTable(dialect: "sqlite"): SqliteThreadsTable;
export function defineThreadsTable(dialect: "mysql"): MysqlThreadsTable;
export function defineThreadsTable(dialect: SchemaDialect) {
  if (dialect === "postgres") {
    return definePostgresThreadsTable();
  }

  if (dialect === "sqlite") {
    return defineSqliteThreadsTable();
  }

  return defineMysqlThreadsTable();
}
