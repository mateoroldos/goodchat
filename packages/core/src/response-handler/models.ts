import type { Tool } from "ai";
import { z } from "zod";
import type { BotConfig, MCPServerConfig } from "../config/models";
import { platformSchema } from "../config/models";

export const incomingMessageSchema = z.object({
  botName: z.string().min(1, "Bot name is required"),
  platform: platformSchema,
  text: z.string().min(1, "Text is required"),
  threadId: z.string().min(1, "Thread ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

export type IncomingMessage = z.infer<typeof incomingMessageSchema>;

export interface BotResponse {
  text: string;
}

export interface BotRuntimeContext {
  mcp?: MCPServerConfig[];
  modelId?: string;
  systemPromptExtensions?: string;
  tools?: Record<string, Tool>;
}

export interface ResponseRequest {
  botConfig: BotConfig;
  message: IncomingMessage;
  runtime?: BotRuntimeContext;
}
