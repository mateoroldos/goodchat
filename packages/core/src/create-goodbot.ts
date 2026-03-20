import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import type { BotConfig } from "./config/models";
import { deriveBotId } from "./config/models";
import {
  type GoodbotOptionsInput,
  goodbotOptionsSchema,
} from "./create-goodbot.schema";
import { InMemoryMessageStoreService } from "./message-store/index";
import { validatePluginEnv } from "./plugins/env";
import { mergePlugins } from "./plugins/merge";
import type { GoodbotPlugin } from "./plugins/models";
import { isPluginDescriptor } from "./plugins/models";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { botController } from "./server/bot-controller";
import { threadsController } from "./server/threads-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

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
    if (!isPluginDescriptor(p)) {
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
  const runtimeResult = createChatRuntime(botConfig, store, extensions);
  if (runtimeResult.isErr()) {
    throw runtimeResult.error;
  }

  const chatRuntime = runtimeResult.value;
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
