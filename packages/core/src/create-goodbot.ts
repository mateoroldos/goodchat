import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import type { BotConfig } from "./config/models";
import { InMemoryMessageStoreService } from "./message-store/index";
import type { MessageStoreService } from "./message-store/message-store.service.interface";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { botController } from "./server/bot-controller";
import { threadsController } from "./server/threads-controller";
import type { WebhookEnv } from "./server/webhook-chat-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

interface GoodbotOptions {
  botConfig: BotConfig;
  corsOrigin?: string | ((request: Request) => boolean);
  isServerless?: boolean;
  messageStore?: MessageStoreService;
  webBuildPath?: string;
  webhookEnv?: WebhookEnv;
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
  botConfig,
  messageStore,
  corsOrigin,
  withDashboard = true,
  isServerless = false,
  webBuildPath,
  webhookEnv = {},
}: GoodbotOptions) => {
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

  if (withDashboard && !isServerless && webBuildPath) {
    try {
      const webIndexHtml = await readFile(join(webBuildPath, "index.html"));
      app.use(
        staticPlugin({
          assets: webBuildPath,
          prefix: "/",
          alwaysStatic: true,
          indexHTML: true,
        })
      );

      app.get("/*", ({ set }: { set: { headers: Record<string, string> } }) => {
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
