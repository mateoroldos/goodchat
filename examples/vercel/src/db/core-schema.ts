import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
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

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role"),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  metadata: jsonb("metadata"),
  userId: text("user_id").notNull(),
  adapterName: text("adapter_name").notNull(),
});

export const aiRuns = pgTable("ai_runs", {
  id: text("id").primaryKey(),
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
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  durationMs: integer("duration_ms"),
  usage: jsonb("usage"),
  providerMetadata: jsonb("provider_metadata"),
  createdAt: text("created_at").notNull(),
  finishedAt: text("finished_at"),
});

export const aiRunToolCalls = pgTable("ai_run_tool_calls", {
  id: text("id").primaryKey(),
  aiRunId: text("ai_run_id").notNull(),
  toolCallId: text("tool_call_id"),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull(),
  durationMs: integer("duration_ms"),
  input: jsonb("input"),
  output: jsonb("output"),
  error: jsonb("error"),
  createdAt: text("created_at").notNull(),
});

export const coreSchema = {
  aiRuns,
  aiRunToolCalls,
  threads,
  messages,
};
