import type { Tool } from "ai";
import type { MCPServerConfig } from "../config/models";
import type { GoodbotExtensions, GoodbotHooks, GoodbotPlugin } from "./models";

interface BaseExtensions {
  hooks?: GoodbotHooks;
  mcp?: MCPServerConfig[];
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export const mergePlugins = (
  plugins: GoodbotPlugin[],
  base: BaseExtensions = {}
): GoodbotExtensions => {
  const extensions: GoodbotExtensions = {
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
