import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { FileConfigService } from "@goodchat/core/config/config.service";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";
import { env } from "./env";
import { botsController } from "./modules/bots";
import { webhookChatController } from "./modules/chat";
import { threadsController } from "./modules/threads";

const configService = new FileConfigService();
const botResult = await configService.loadBotConfigs();
if (botResult.isErr()) {
  console.error("Failed to load bot configs:", botResult.error.message);
  process.exit(1);
}

const botConfigs = botResult.value;

const messageStore = new InMemoryMessageStoreService();

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
    })
  )
  .use(openapi());

const api = new Elysia({ prefix: "/api" })
  .use(botsController(botConfigs))
  .use(threadsController(messageStore))
  .get("/health", () => "OK");

for (const botConfig of botConfigs) {
  const chatController = webhookChatController(botConfig, messageStore);
  if (chatController) {
    api.use(chatController);
  }
}

app.use(api);

const webBuildPath = join(import.meta.dir, "../../web/build");
let webIndexHtml: Buffer | null = null;

try {
  webIndexHtml = await readFile(join(webBuildPath, "index.html"));
} catch (error) {
  if (env.NODE_ENV === "production") {
    console.error("Failed to load web build:", error);
    process.exit(1);
  }
}

if (webIndexHtml) {
  app.use(
    staticPlugin({
      assets: webBuildPath,
      prefix: "/",
      alwaysStatic: true,
      indexHTML: true,
    })
  );

  app.get("/*", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return webIndexHtml;
  });
}

export type App = typeof app;
