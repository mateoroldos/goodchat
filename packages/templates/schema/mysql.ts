import { json, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

export const threads = mysqlTable("goodchat_threads", {
  id: varchar("id", { length: 191 }).primaryKey(),
  botId: text("bot_id").notNull(),
  botName: text("bot_name").notNull(),
  platform: text("platform").notNull(),
  adapterName: text("adapter_name").notNull(),
  threadId: text("thread_id").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  responseText: text("response_text").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastActivityAt: text("last_activity_at").notNull(),
});

export const messages = mysqlTable("goodchat_messages", {
  id: varchar("id", { length: 191 }).primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role"),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  metadata: json("metadata"),
  userId: text("user_id").notNull(),
  adapterName: text("adapter_name").notNull(),
});

export const mysqlSchema = {
  threads,
  messages,
};
