import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import {
  mcpServerSchema,
  toolSchema,
} from "@goodchat/contracts/capabilities/models";
import { botConfigSchema } from "@goodchat/contracts/config/models";
import type { BotConfig } from "@goodchat/contracts/config/types";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import { goodchatHooksSchema } from "@goodchat/contracts/hooks/models";
import {
  goodchatPluginDefinitionSchema,
  goodchatPluginFactorySchema,
  goodchatPluginSchema,
} from "@goodchat/contracts/plugins/models";
import type { GoodchatPlugin } from "@goodchat/contracts/plugins/types";
import {
  isPluginDefinition,
  isPluginFactory,
} from "@goodchat/contracts/plugins/types";
import { Elysia } from "elysia";
import z from "zod";
import { validatePluginEnv, validatePluginParams } from "./extensions/env";
import { mergePlugins } from "./extensions/merge";
import { InMemoryMessageStoreService } from "./message-store/index";
import type { MessageStoreService } from "./message-store/interface";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { botController } from "./server/bot-controller";
import { localChatController } from "./server/local-chat-controller";
import { threadsController } from "./server/threads-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

const corsOriginSchema = z.custom<string | ((request: Request) => boolean)>(
  (value) => typeof value === "string" || typeof value === "function",
  {
    message: "CORS origin must be a string or function",
  }
);

export const goodchatOptionsSchema = botConfigSchema.extend({
  corsOrigin: corsOriginSchema.optional(),
  hooks: goodchatHooksSchema.optional(),
  id: z.string().min(1, "Bot id is required").optional(),
  isServerless: z.boolean().optional(),
  mcp: z.array(mcpServerSchema).optional(),
  messageStore: z.custom<MessageStoreService>().optional(),
  name: z.string().min(1, "Bot name is required"),
  platforms: botConfigSchema.shape.platforms,
  plugins: z
    .array(
      z.union([
        goodchatPluginDefinitionSchema,
        goodchatPluginFactorySchema,
        goodchatPluginSchema,
      ])
    )
    .optional(),
  prompt: z.string().min(1, "Bot prompt is required"),
  tools: z.record(z.string(), toolSchema).optional(),
  withDashboard: z.boolean().optional(),
});

export type GoodchatOptionsInput = z.infer<typeof goodchatOptionsSchema>;

const sameOriginCors = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const createGoodchat = async (options: GoodchatOptionsInput) => {
  const {
    name,
    prompt,
    platforms,
    id,
    messageStore,
    corsOrigin,
    plugins = [],
    tools,
    hooks,
    mcp,
    withDashboard = true,
    isServerless = false,
  } = goodchatOptionsSchema.parse(options);
  const coreDir = dirname(fileURLToPath(import.meta.url));
  const packagedWebBuildPath = join(coreDir, "web");
  const webBuildPath = packagedWebBuildPath;

  const botConfig: BotConfig = {
    id: id ?? deriveBotId(name),
    name,
    prompt,
    platforms,
  };

  const resolvedPlugins: GoodchatPlugin[] = plugins.map((p) => {
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
  });

  const extensions = mergePlugins(resolvedPlugins, { hooks, mcp, tools });

  const webhookEnv = {
    CRON_SECRET: process.env.CRON_SECRET,
    WEBHOOK_FORWARD_URL: process.env.WEBHOOK_FORWARD_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  const store = messageStore ?? new InMemoryMessageStoreService();
  const chatRuntime = createChatRuntime(botConfig, store, extensions);
  await chatRuntime.gateway.initialize();

  const app = new Elysia()
    .use(
      cors({
        origin: corsOrigin ?? sameOriginCors,
        methods: ["GET", "POST", "PATCH", "OPTIONS"],
      })
    )
    .use(openapi());

  const api = new Elysia({ prefix: "/api" })
    .use(botController(botConfig))
    .use(threadsController(store))
    .use(
      webhookChatController({
        botConfig,
        chatRuntime,
        env: webhookEnv,
        isServerless,
      })
    )
    .get("/health", () => "OK");

  if (botConfig.platforms.includes("local")) {
    api.use(
      localChatController({
        botConfig,
        responseHandler: chatRuntime.responseHandler,
      })
    );
  }

  app.use(api);

  if (withDashboard && !isServerless) {
    try {
      const webIndexHtml = await readFile(join(webBuildPath, "index.html"));
      app.use(
        staticPlugin({
          assets: webBuildPath,
          prefix: "/",
          alwaysStatic: true,
          indexHTML: false,
        })
      );

      app.get("/*", ({ set }) => {
        set.headers["content-type"] = "text/html; charset=utf-8";
        return webIndexHtml;
      });
    } catch (error) {
      throw new Error("Dashboard build not found at found.", { cause: error });
    }
  }

  return { app, api, chatRuntime };
};

export type GoodchatApi = Awaited<ReturnType<typeof createGoodchat>>["api"];
