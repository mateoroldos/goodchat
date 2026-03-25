import type { Tool } from "ai";
import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import type { MCPServerConfig } from "../capabilities/types";
import type { GoodchatHooks } from "../hooks/types";

export type {
  BotResponse,
  GoodchatHooks,
  MessageContext,
} from "../hooks/types";

export interface GoodchatPlugin {
  hooks?: GoodchatHooks;
  mcp?: MCPServerConfig[];
  name: string;
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export interface GoodchatPluginDefinition<
  TShape extends ZodRawShape = ZodRawShape,
> {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodchatPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}

export const isPluginDefinition = (
  p: GoodchatPlugin | GoodchatPluginDefinition
): p is GoodchatPluginDefinition => "create" in p;
