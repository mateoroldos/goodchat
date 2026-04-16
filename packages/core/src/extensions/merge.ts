import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { BotConfigInput } from "@goodchat/contracts/config/types";
import type {
  GoodchatHooks,
  GoodchatPlugin,
} from "@goodchat/contracts/plugins/types";
import {
  isPluginDefinition,
  isPluginFactory,
} from "@goodchat/contracts/plugins/types";
import type { Tool } from "ai";
import { validatePluginEnv, validatePluginParams } from "../extensions/env";
import type { GoodchatExtensions } from "./models";

interface BaseExtensions {
  hooks: GoodchatHooks;
  mcp: MCPServerConfig[];
  systemPrompt?: string;
  tools: Record<string, Tool>;
}

export const mergePlugins = (
  plugins: GoodchatPlugin[],
  base: BaseExtensions
): GoodchatExtensions => {
  const extensions: GoodchatExtensions = {
    afterMessage: [],
    beforeMessage: [],
    mcp: [...(base.mcp ?? [])],
    systemPrompt: base.systemPrompt ?? "",
    tools: { ...(base.tools ?? {}) },
  };

  if (base.hooks?.beforeMessage) {
    extensions.beforeMessage.push(base.hooks.beforeMessage);
  }
  if (base.hooks?.afterMessage) {
    extensions.afterMessage.push(base.hooks.afterMessage);
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
      extensions.beforeMessage.push(plugin.hooks.beforeMessage);
    }
    if (plugin.hooks?.afterMessage) {
      extensions.afterMessage.push(plugin.hooks.afterMessage);
    }
  }

  return extensions;
};

export const resolvePlugins = (bot: BotConfigInput): GoodchatPlugin[] =>
  bot.plugins
    ? bot.plugins.map((p) => {
        const pluginDefinition = isPluginFactory(p) ? p() : p;
        if (!isPluginDefinition(pluginDefinition)) {
          return pluginDefinition;
        }
        const env = pluginDefinition.env
          ? validatePluginEnv(pluginDefinition.name, pluginDefinition.env)
          : ({} as never);
        if (pluginDefinition.paramsSchema) {
          if (pluginDefinition.params === undefined) {
            throw new Error(
              `Plugin "${pluginDefinition.name}" params are required. Check the plugin configuration values.`
            );
          }
          const params = validatePluginParams(
            pluginDefinition.name,
            pluginDefinition.paramsSchema,
            pluginDefinition.params
          );
          return {
            name: pluginDefinition.name,
            ...pluginDefinition.create(env, params),
          };
        }

        return {
          name: pluginDefinition.name,
          ...pluginDefinition.create(env, undefined),
        };
      })
    : [];
