import { PINNED_BETTER_AUTH_TABLES } from "./generated-auth-tables";
import type { SchemaDialect, SchemaTableDeclaration } from "./types";

export const CORE_SCHEMA_TABLES = [
  {
    tableName: "threads",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "bot_id", dataType: "text", notNull: true },
      { columnName: "bot_name", dataType: "text", notNull: true },
      { columnName: "platform", dataType: "text", notNull: true },
      { columnName: "adapter_name", dataType: "text", notNull: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "text", dataType: "text", notNull: true },
      { columnName: "response_text", dataType: "text", notNull: true },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "updated_at", dataType: "text", notNull: true },
      { columnName: "last_activity_at", dataType: "text", notNull: true },
    ],
    relations: [
      { kind: "many", name: "messages", targetTable: "messages" },
      { kind: "many", name: "aiRuns", targetTable: "ai_runs" },
    ],
  },
  {
    tableName: "messages",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "role", dataType: "text" },
      { columnName: "text", dataType: "text", notNull: true },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "metadata", dataType: "json" },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "adapter_name", dataType: "text", notNull: true },
    ],
    relations: [
      {
        kind: "one",
        name: "thread",
        targetTable: "threads",
        fields: ["threadId"],
        references: ["id"],
      },
    ],
  },
  {
    tableName: "ai_runs",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "assistant_message_id", dataType: "text", notNull: true },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "mode", dataType: "text", notNull: true },
      { columnName: "provider", dataType: "text", notNull: true },
      { columnName: "model_id", dataType: "text", notNull: true },
      { columnName: "finish_reason", dataType: "text" },
      { columnName: "had_error", dataType: "boolean", notNull: true },
      { columnName: "error_code", dataType: "text" },
      { columnName: "error_message", dataType: "text" },
      { columnName: "input_tokens", dataType: "integer" },
      { columnName: "output_tokens", dataType: "integer" },
      { columnName: "total_tokens", dataType: "integer" },
      { columnName: "duration_ms", dataType: "integer" },
      { columnName: "usage", dataType: "json" },
      { columnName: "provider_metadata", dataType: "json" },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "finished_at", dataType: "text" },
    ],
    relations: [
      {
        kind: "one",
        name: "thread",
        targetTable: "threads",
        fields: ["threadId"],
        references: ["id"],
      },
      { kind: "many", name: "toolCalls", targetTable: "ai_run_tool_calls" },
    ],
  },
  {
    tableName: "ai_run_tool_calls",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "ai_run_id", dataType: "text", notNull: true },
      { columnName: "tool_call_id", dataType: "text" },
      { columnName: "tool_name", dataType: "text", notNull: true },
      { columnName: "status", dataType: "text", notNull: true },
      { columnName: "duration_ms", dataType: "integer" },
      { columnName: "input", dataType: "json" },
      { columnName: "output", dataType: "json" },
      { columnName: "error", dataType: "json" },
      { columnName: "created_at", dataType: "text", notNull: true },
    ],
    relations: [
      {
        kind: "one",
        name: "aiRun",
        targetTable: "ai_runs",
        fields: ["aiRunId"],
        references: ["id"],
      },
    ],
  },
] as const satisfies readonly SchemaTableDeclaration[];

export const AUTH_SCHEMA_TABLES_BY_DIALECT = {
  sqlite: PINNED_BETTER_AUTH_TABLES,
  postgres: PINNED_BETTER_AUTH_TABLES,
  mysql: PINNED_BETTER_AUTH_TABLES,
} as const satisfies Record<SchemaDialect, readonly SchemaTableDeclaration[]>;
