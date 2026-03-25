import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { GoodchatHooks } from "@goodchat/contracts/plugins/types";
import type { Tool } from "ai";

export interface GoodchatExtensions {
  afterMessageHooks: NonNullable<GoodchatHooks["afterMessage"]>[];
  beforeMessageHooks: NonNullable<GoodchatHooks["beforeMessage"]>[];
  mcp: MCPServerConfig[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}
