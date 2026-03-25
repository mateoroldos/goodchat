import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type {
  GoodchatHooks,
  GoodchatPlugin,
} from "@goodchat/contracts/plugins/types";
import type { Tool } from "ai";
import type { GoodchatExtensions } from "./models";

interface BaseExtensions {
  hooks?: GoodchatHooks;
  mcp?: MCPServerConfig[];
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export const mergePlugins = (
  plugins: GoodchatPlugin[],
  base: BaseExtensions = {}
): GoodchatExtensions => {
  const extensions: GoodchatExtensions = {
    afterMessageHooks: [],
    beforeMessageHooks: [],
    mcp: [...(base.mcp ?? [])],
    systemPrompt: base.systemPrompt ?? "",
    tools: { ...(base.tools ?? {}) },
  };

  if (base.hooks?.beforeMessage) {
    extensions.beforeMessageHooks.push(base.hooks.beforeMessage);
  }
  if (base.hooks?.afterMessage) {
    extensions.afterMessageHooks.push(base.hooks.afterMessage);
  }

  for (const plugin of plugins) {
    Object.assign(extensions.tools, plugin.tools ?? {});
    extensions.mcp.push(...(plugin.mcp ?? []));

    if (plugin.systemPrompt) {
      extensions.systemPrompt = extensions.systemPrompt
        ? `${extensions.systemPrompt}\n\n${plugin.systemPrompt}`
        : plugin.systemPrompt;
    }

    if (plugin.hooks?.beforeMessage) {
      extensions.beforeMessageHooks.push(plugin.hooks.beforeMessage);
    }
    if (plugin.hooks?.afterMessage) {
      extensions.afterMessageHooks.push(plugin.hooks.afterMessage);
    }
  }

  return extensions;
};
