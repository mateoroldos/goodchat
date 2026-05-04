import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { BotConfigInput } from "@goodchat/contracts/config/types";
import type {
  GoodchatHooks,
  GoodchatPluginDefinitionAny,
  GoodchatResolvedPlugin,
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
  plugins: GoodchatResolvedPlugin[],
  base: BaseExtensions
): GoodchatExtensions => {
  const extensions: GoodchatExtensions = {
    afterMessage: [],
    beforeMessage: [],
    hookRegistrations: [],
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

    if (plugin.hooks?.beforeMessage || plugin.hooks?.afterMessage) {
      extensions.hookRegistrations.push({
        afterMessage: plugin.hooks?.afterMessage,
        beforeMessage: plugin.hooks?.beforeMessage,
        pluginKey: plugin.key,
        pluginName: plugin.name,
        schema: plugin.schema ?? [],
      });
    }
  }

  return extensions;
};

// Resolves mixed plugin inputs (plain object, definition, or factory) into a
// single internal runtime shape used by core extension assembly.
export const resolvePlugins = (
  bot: BotConfigInput
): GoodchatResolvedPlugin[] =>
  bot.plugins
    ? bot.plugins.map((p) => {
        const pluginCandidate: unknown = isPluginFactory(p) ? p() : p;
        if (!isPluginDefinition(pluginCandidate as never)) {
          return pluginCandidate as GoodchatResolvedPlugin;
        }
        const pluginDefinition = pluginCandidate as GoodchatPluginDefinitionAny;
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
            key: pluginDefinition.key,
            name: pluginDefinition.name,
            schema: pluginDefinition.schema,
            ...pluginDefinition.create(env, params),
          };
        }

        return {
          key: pluginDefinition.key,
          name: pluginDefinition.name,
          schema: pluginDefinition.schema,
          ...pluginDefinition.create(env, undefined),
        };
      })
    : [];
