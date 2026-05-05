import { relations } from "drizzle-orm";
import {
  boolean,
  int,
  json,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const threads = mysqlTable("threads", {
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

export const messages = mysqlTable("messages", {
  id: varchar("id", { length: 191 }).primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role"),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  metadata: json("metadata"),
  userId: text("user_id").notNull(),
  adapterName: text("adapter_name").notNull(),
});

export const aiRuns = mysqlTable("ai_runs", {
  id: varchar("id", { length: 191 }).primaryKey(),
  threadId: text("thread_id").notNull(),
  assistantMessageId: text("assistant_message_id").notNull(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  finishReason: text("finish_reason"),
  hadError: boolean("had_error").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  inputTokens: int("input_tokens"),
  outputTokens: int("output_tokens"),
  totalTokens: int("total_tokens"),
  durationMs: int("duration_ms"),
  usage: json("usage"),
  providerMetadata: json("provider_metadata"),
  createdAt: text("created_at").notNull(),
  finishedAt: text("finished_at"),
});

export const aiRunToolCalls = mysqlTable("ai_run_tool_calls", {
  id: varchar("id", { length: 191 }).primaryKey(),
  aiRunId: text("ai_run_id").notNull(),
  toolCallId: text("tool_call_id"),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull(),
  durationMs: int("duration_ms"),
  input: json("input"),
  output: json("output"),
  error: json("error"),
  createdAt: text("created_at").notNull(),
});
export const threadsRelations = relations(threads, ({ many }) => ({
  messages: many(messages),
  aiRuns: many(aiRuns),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
}));

export const aiRunsRelations = relations(aiRuns, ({ one, many }) => ({
  thread: one(threads, { fields: [aiRuns.threadId], references: [threads.id] }),
  toolCalls: many(aiRunToolCalls),
}));

export const aiRunToolCallsRelations = relations(aiRunToolCalls, ({ one }) => ({
  aiRun: one(aiRuns, {
    fields: [aiRunToolCalls.aiRunId],
    references: [aiRuns.id],
  }),
}));

export const mysqlSchema = {
  aiRuns,
  aiRunToolCalls,
  threads,
  messages,
};
