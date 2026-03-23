import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import {
  mcpServerSchema,
  toolSchema,
} from "@goodbot/contracts/capabilities/models";
import { botConfigSchema } from "@goodbot/contracts/config/models";
import type { BotConfig } from "@goodbot/contracts/config/types";
import { deriveBotId } from "@goodbot/contracts/config/utils";
import { goodbotHooksSchema } from "@goodbot/contracts/hooks/models";
import {
  goodbotPluginDefinitionSchema,
  goodbotPluginSchema,
} from "@goodbot/contracts/plugins/models";
import type { GoodbotPlugin } from "@goodbot/contracts/plugins/types";
import { isPluginDefinition } from "@goodbot/contracts/plugins/types";
import { Elysia } from "elysia";
import z from "zod";
import { validatePluginEnv } from "./extensions/env";
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

export const goodbotOptionsSchema = botConfigSchema.extend({
  corsOrigin: corsOriginSchema.optional(),
  hooks: goodbotHooksSchema.optional(),
  id: z.string().min(1, "Bot id is required").optional(),
  isServerless: z.boolean().optional(),
  mcp: z.array(mcpServerSchema).optional(),
  messageStore: z.custom<MessageStoreService>().optional(),
  name: z.string().min(1, "Bot name is required"),
  platforms: botConfigSchema.shape.platforms,
  plugins: z
    .array(z.union([goodbotPluginDefinitionSchema, goodbotPluginSchema]))
    .optional(),
  prompt: z.string().min(1, "Bot prompt is required"),
  tools: z.record(z.string(), toolSchema).optional(),
  withDashboard: z.boolean().optional(),
});

export type GoodbotOptionsInput = z.infer<typeof goodbotOptionsSchema>;

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

export const createGoodbot = async (options: GoodbotOptionsInput) => {
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
  } = goodbotOptionsSchema.parse(options);
  const coreDir = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(coreDir, "../../..");
  const webBuildPath =
    process.env.WEB_BUILD_PATH ?? join(rootDir, "apps/web/build");

  const botConfig: BotConfig = {
    id: id ?? deriveBotId(name),
    name,
    prompt,
    platforms,
  };

  const resolvedPlugins: GoodbotPlugin[] = plugins.map((p) => {
    if (!isPluginDefinition(p)) {
      return p;
    }
    const env = p.env ? validatePluginEnv(p.name, p.env) : ({} as never);
    return { name: p.name, ...p.create(env) };
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
      if (webhookEnv.NODE_ENV === "production") {
        throw error;
      }
    }
  }

  return { app, api, chatRuntime };
};
