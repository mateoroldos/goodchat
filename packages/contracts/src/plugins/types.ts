import type { Tool } from "ai";
import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import type { MCPServerConfig } from "../capabilities/types";
import type { GoodbotHooks } from "../hooks/types";

export type { BotResponse, GoodbotHooks, MessageContext } from "../hooks/types";

export interface GoodbotPlugin {
  hooks?: GoodbotHooks;
  mcp?: MCPServerConfig[];
  name: string;
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export interface GoodbotPluginDefinition<
  TShape extends ZodRawShape = ZodRawShape,
> {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodbotPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}

export const isPluginDefinition = (
  p: GoodbotPlugin | GoodbotPluginDefinition
): p is GoodbotPluginDefinition => "create" in p;
