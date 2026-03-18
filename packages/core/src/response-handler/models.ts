import { z } from "zod";
import type { BotConfig } from "../config/models";
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
  mcp?: unknown;
  modelId?: string;
  tools?: unknown;
}

export interface ResponseRequest {
  botConfig: BotConfig;
  message: IncomingMessage;
  runtime?: BotRuntimeContext;
}
