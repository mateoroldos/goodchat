import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import type { BotConfig, Platform } from "./config/models";
import { deriveBotId } from "./config/models";
import { InMemoryMessageStoreService } from "./message-store/index";
import type { MessageStoreService } from "./message-store/message-store.service.interface";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { botController } from "./server/bot-controller";
import { threadsController } from "./server/threads-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

interface GoodbotOptions {
  corsOrigin?: string | ((request: Request) => boolean);
  id?: string;
  isServerless?: boolean;
  messageStore?: MessageStoreService;
  name: string;
  platforms: Platform[];
  prompt: string;
  withDashboard?: boolean;
}

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

export const createGoodbot = async ({
  name,
  prompt,
  platforms,
  id,
  messageStore,
  corsOrigin,
  withDashboard = true,
  isServerless = false,
}: GoodbotOptions) => {
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

  const webhookEnv = {
    CRON_SECRET: process.env.CRON_SECRET,
    WEBHOOK_FORWARD_URL: process.env.WEBHOOK_FORWARD_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  const store = messageStore ?? new InMemoryMessageStoreService();
  const runtimeResult = createChatRuntime(botConfig, store);
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
