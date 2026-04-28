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

export const mysqlSchema = {
  aiRuns,
  aiRunToolCalls,
  threads,
  messages,
};
