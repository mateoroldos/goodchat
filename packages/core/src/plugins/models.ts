import type { Tool } from "ai";
import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import z from "zod";
import { goodbotHooksSchema, toolSchema } from "../capabilities/models";
import type { BotConfig, MCPServerConfig, Platform } from "../config/models";
import { mcpServerSchema } from "../config/models";
import type { BotResponse, IncomingMessage } from "../response-handler/models";

export interface PluginChatContext {
  adapterName: string;
  botConfig: BotConfig;
  platform: Platform;
  threadId: string;
  userId: string;
}

export interface GoodbotHooks {
  afterMessage?: (
    context: PluginChatContext,
    message: IncomingMessage,
    response: BotResponse
  ) => Promise<void>;
  beforeMessage?: (
    context: PluginChatContext,
    message: IncomingMessage
  ) => Promise<void>;
}

export interface GoodbotPlugin {
  hooks?: GoodbotHooks;
  mcp?: MCPServerConfig[];
  name: string;
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export interface GoodbotExtensions {
  afterMessageHooks: NonNullable<GoodbotHooks["afterMessage"]>[];
  beforeMessageHooks: NonNullable<GoodbotHooks["beforeMessage"]>[];
  mcp: MCPServerConfig[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}

export interface GoodbotPluginDescriptor<
  TShape extends ZodRawShape = ZodRawShape,
> {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodbotPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}

export const isPluginDescriptor = (
  p: GoodbotPlugin | GoodbotPluginDescriptor
): p is GoodbotPluginDescriptor => "create" in p;

const zodSchemaSchema = z.custom<ZodObject<ZodRawShape>>(
  (value) =>
    value !== null && typeof value === "object" && "safeParse" in value,
  {
    message: "Expected a zod schema",
  }
);

export const goodbotPluginSchema = z.object({
  hooks: goodbotHooksSchema.optional(),
  mcp: z.array(mcpServerSchema).optional(),
  name: z.string().min(1, "Plugin name is required"),
  systemPrompt: z.string().optional(),
  tools: z.record(z.string(), toolSchema).optional(),
});

export const goodbotPluginDescriptorSchema = z.object({
  create: z.custom<GoodbotPluginDescriptor["create"]>(
    (value) => typeof value === "function",
    {
      message: "Expected a function",
    }
  ),
  env: zodSchemaSchema.optional(),
  name: z.string().min(1, "Plugin name is required"),
});
