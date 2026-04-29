import type { GoodchatSchema } from "@goodchat/contracts/db/types";

export const coreSchema = {
  threads: {
    order: 1,
    columns: {
      id: { type: "string" },
      botId: { type: "string", required: true, columnName: "bot_id" },
      botName: { type: "string", required: true, columnName: "bot_name" },
      platform: { type: "string", required: true },
      adapterName: {
        type: "string",
        required: true,
        columnName: "adapter_name",
      },
      threadId: { type: "string", required: true, columnName: "thread_id" },
      userId: { type: "string", required: true, columnName: "user_id" },
      text: { type: "string", required: true },
      responseText: {
        type: "string",
        required: true,
        columnName: "response_text",
      },
      createdAt: { type: "date", required: true, columnName: "created_at" },
      updatedAt: { type: "date", required: true, columnName: "updated_at" },
      lastActivityAt: {
        type: "date",
        required: true,
        columnName: "last_activity_at",
      },
    },
  },
  messages: {
    order: 2,
    columns: {
      id: { type: "string" },
      threadId: { type: "string", required: true, columnName: "thread_id" },
      role: { type: "string", required: false },
      text: { type: "string", required: true },
      createdAt: { type: "string", required: true, columnName: "created_at" },
      metadata: { type: "json", required: false },
      userId: { type: "string", required: true, columnName: "user_id" },
      adapterName: {
        type: "string",
        required: true,
        columnName: "adapter_name",
      },
    },
  },
  aiRuns: {
    tableName: "ai_runs",
    order: 3,
    columns: {
      id: { type: "string" },
      threadId: { type: "string", required: true, columnName: "thread_id" },
      assistantMessageId: {
        type: "string",
        required: true,
        columnName: "assistant_message_id",
      },
      userId: { type: "string", required: true, columnName: "user_id" },
      mode: { type: "string", required: true },
      provider: { type: "string", required: true },
      modelId: { type: "string", required: true, columnName: "model_id" },
      finishReason: {
        type: "string",
        required: false,
        columnName: "finish_reason",
      },
      hadError: { type: "boolean", required: true, columnName: "had_error" },
      errorCode: { type: "string", required: false, columnName: "error_code" },
      errorMessage: {
        type: "string",
        required: false,
        columnName: "error_message",
      },
      inputTokens: {
        type: "number",
        required: false,
        columnName: "input_tokens",
      },
      outputTokens: {
        type: "number",
        required: false,
        columnName: "output_tokens",
      },
      totalTokens: {
        type: "number",
        required: false,
        columnName: "total_tokens",
      },
      durationMs: {
        type: "number",
        required: false,
        columnName: "duration_ms",
      },
      usage: { type: "json", required: false },
      providerMetadata: {
        type: "json",
        required: false,
        columnName: "provider_metadata",
      },
      createdAt: { type: "date", required: true, columnName: "created_at" },
      finishedAt: {
        type: "date",
        required: false,
        columnName: "finished_at",
      },
    },
  },
  aiRunToolCalls: {
    tableName: "ai_run_tool_calls",
    order: 4,
    columns: {
      id: { type: "string" },
      aiRunId: { type: "string", required: true, columnName: "ai_run_id" },
      toolCallId: {
        type: "string",
        required: false,
        columnName: "tool_call_id",
      },
      toolName: { type: "string", required: true, columnName: "tool_name" },
      status: { type: "string", required: true },
      durationMs: {
        type: "number",
        required: false,
        columnName: "duration_ms",
      },
      input: { type: "json", required: false },
      output: { type: "json", required: false },
      error: { type: "json", required: false },
      createdAt: { type: "string", required: true, columnName: "created_at" },
    },
  },
} satisfies GoodchatSchema;
