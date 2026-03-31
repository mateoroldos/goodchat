import {
  json as mysqlJson,
  mysqlTable,
  text as mysqlText,
} from "drizzle-orm/mysql-core";
import { jsonb, pgTable, text as pgText } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import type { SchemaDialect } from "./schema-types";

export const defineMessagesTable = (dialect: SchemaDialect) => {
  if (dialect === "postgres") {
    return pgTable("goodchat_messages", {
      id: pgText("id").primaryKey(),
      threadId: pgText("thread_id").notNull(),
      role: pgText("role"),
      text: pgText("text").notNull(),
      createdAt: pgText("created_at").notNull(),
      metadata: jsonb("metadata"),
      userId: pgText("user_id").notNull(),
      adapterName: pgText("adapter_name").notNull(),
    });
  }

  if (dialect === "sqlite") {
    return sqliteTable("goodchat_messages", {
      id: sqliteText("id").primaryKey(),
      threadId: sqliteText("thread_id").notNull(),
      role: sqliteText("role"),
      text: sqliteText("text").notNull(),
      createdAt: sqliteText("created_at").notNull(),
      metadata: sqliteText("metadata", { mode: "json" }),
      userId: sqliteText("user_id").notNull(),
      adapterName: sqliteText("adapter_name").notNull(),
    });
  }

  return mysqlTable("goodchat_messages", {
    id: mysqlText("id").primaryKey(),
    threadId: mysqlText("thread_id").notNull(),
    role: mysqlText("role"),
    text: mysqlText("text").notNull(),
    createdAt: mysqlText("created_at").notNull(),
    metadata: mysqlJson("metadata"),
    userId: mysqlText("user_id").notNull(),
    adapterName: mysqlText("adapter_name").notNull(),
  });
};
