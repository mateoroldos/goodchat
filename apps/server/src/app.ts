import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { FileConfigService } from "@goodchat/core/config/config.service";
import { watchBotConfigs } from "@goodchat/core/config/config-watcher";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";
import { env } from "./env";
import { botsController } from "./modules/bots";
import { webhookChatController } from "./modules/chat";
import { threadsController } from "./modules/threads";
import { BotRegistry } from "./runtime/bot-registry";

const configService = new FileConfigService();
const messageStore = new InMemoryMessageStoreService();
const botRegistry = new BotRegistry(messageStore);

const botResult = await configService.loadBotConfigs();
if (botResult.isErr()) {
  console.error("Failed to load bot configs:", botResult.error.message);
  process.exit(1);
}

await botRegistry.applyConfigs(botResult.value);

const watcherResult = await watchBotConfigs({
  configService,
  onReload: async (configs) => {
    await botRegistry.applyConfigs(configs);
  },
  onError: (error) => {
    console.error("Failed to reload bot configs:", error.message);
  },
});

if (watcherResult.isErr()) {
  console.error(
    "Failed to start bot config watcher:",
    watcherResult.error.message
  );
}

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
    })
  )
  .use(openapi());

const api = new Elysia({ prefix: "/api" })
  .use(botsController(botRegistry, messageStore))
  .use(threadsController(messageStore))
  .use(webhookChatController(botRegistry))
  .get("/health", () => "OK");

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

export type App = typeof api;
