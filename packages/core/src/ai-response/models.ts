import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { Tool, UIMessageChunk } from "ai";

export interface AiCallParams {
  mcp?: MCPServerConfig[];
  model?: string;
  systemPrompt: string;
  tools?: Record<string, Tool>;
  userMessage: string;
}

export interface AiResponse {
  text: string;
}

export interface AiResponseStream {
  uiStream: ReadableStream<UIMessageChunk>;
}
