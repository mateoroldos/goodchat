import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const threads = pgTable("goodchat_threads", {
  id: text("id").primaryKey(),
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

export const messages = pgTable("goodchat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role"),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  metadata: jsonb("metadata"),
  userId: text("user_id").notNull(),
  adapterName: text("adapter_name").notNull(),
});

export const postgresSchema = {
  threads,
  messages,
};
