import type { BotConfig } from "@goodchat/core/bot.types";
import { InMemoryLogStoreService } from "@goodchat/core/log-store";
import { Elysia } from "elysia";
import { logsController } from "../modules/logs";
import { webhookLocalController } from "../modules/webhook-local";

const DEFAULT_BOT_CONFIG: BotConfig = {
  name: "Echo",
  prompt: "Be friendly",
  platforms: ["local"],
};

export const createTestApp = (botConfig: BotConfig = DEFAULT_BOT_CONFIG) => {
  const logger = new InMemoryLogStoreService();

  const app = new Elysia()
    .get("/", () => "OK")
    .use(webhookLocalController(botConfig, logger))
    .use(logsController(logger));

  return { app, logger };
};
