import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type {
  BotAfterMessageHook,
  BotBeforeMessageHook,
  PluginAfterMessageHook,
  PluginBeforeMessageHook,
} from "@goodchat/contracts/hooks/types";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import type { Tool } from "ai";

export interface HookRegistration {
  afterMessage?: PluginAfterMessageHook;
  beforeMessage?: PluginBeforeMessageHook;
  pluginKey?: string;
  pluginName: string;
  schema: readonly SchemaTableDeclaration[];
}

export interface GoodchatExtensions {
  afterMessage: BotAfterMessageHook[];
  beforeMessage: BotBeforeMessageHook[];
  hookRegistrations: HookRegistration[];
  mcp: MCPServerConfig[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}
