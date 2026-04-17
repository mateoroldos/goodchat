import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { ModelRef } from "@goodchat/contracts/model/model-ref";
import type { Logger } from "@goodchat/contracts/plugins/types";
import type { Tool, UIMessageChunk } from "ai";

export interface AiRunToolCallTelemetry {
  createdAt: string;
  durationMs?: number;
  error?: Record<string, unknown>;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "error" | "success";
  toolCallId?: string;
  toolName: string;
}

export interface AiRunTelemetry {
  createdAt: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  finishedAt?: string;
  finishReason?: string;
  hadError: boolean;
  inputTokens?: number;
  mode: "stream" | "sync";
  modelId: string;
  outputTokens?: number;
  provider: string;
  providerMetadata?: Record<string, unknown>;
  toolCalls: AiRunToolCallTelemetry[];
  totalTokens?: number;
  usage?: Record<string, unknown>;
}

export interface AiCallParams {
  logger: Logger;
  mcp?: MCPServerConfig[];
  mode?: "stream" | "sync";
  model?: ModelRef;
  systemPrompt: string;
  threadId?: string;
  tools?: Record<string, Tool>;
  userId?: string;
  userMessage: string;
}

export interface AiResponse {
  telemetry: AiRunTelemetry;
  text: string;
}

export interface AiResponseStream {
  telemetry: Promise<AiRunTelemetry>;
  uiStream: ReadableStream<UIMessageChunk>;
}
