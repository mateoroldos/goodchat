import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { GoodchatHooks } from "@goodchat/contracts/plugins/types";
import type { Tool } from "ai";

export interface GoodchatExtensions {
  afterMessage: NonNullable<GoodchatHooks["afterMessage"]>[];
  beforeMessage: NonNullable<GoodchatHooks["beforeMessage"]>[];
  mcp: MCPServerConfig[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}
