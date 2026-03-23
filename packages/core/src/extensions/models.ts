import type { MCPServerConfig } from "@goodbot/contracts/capabilities/types";
import type { GoodbotHooks } from "@goodbot/contracts/plugins/types";
import type { Tool } from "ai";

export interface GoodbotExtensions {
  afterMessageHooks: NonNullable<GoodbotHooks["afterMessage"]>[];
  beforeMessageHooks: NonNullable<GoodbotHooks["beforeMessage"]>[];
  mcp: MCPServerConfig[];
  systemPrompt: string;
  tools: Record<string, Tool>;
}
