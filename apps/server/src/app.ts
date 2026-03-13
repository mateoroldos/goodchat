import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { FileConfigService } from "@goodchat/core/config/config.service";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";
import { env } from "./env";
import { botsController } from "./modules/bots";
import { webhookChatController } from "./modules/chat";
import { logsController } from "./modules/logs";

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
  .use(openapi())
  .get("/", () => "OK")
  .use(botsController(botConfigs))
  .use(logsController(messageStore));

for (const botConfig of botConfigs) {
  const chatController = webhookChatController(botConfig, messageStore);
  if (chatController) {
    app.use(chatController);
  }
}

export type App = typeof app;
