import type { BotConfig } from "@goodchat/core/config/models";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";
import { botsController } from "../modules/bots";
import { threadsController } from "../modules/threads";
import { BotRegistry } from "../runtime/bot-registry";

export const createTestApp = async (bots: BotConfig[] = []) => {
  const messageStore = new InMemoryMessageStoreService();
  const botRegistry = new BotRegistry(messageStore);
  await botRegistry.applyConfigs(bots);

  const app = new Elysia()
    .get("/", () => "OK")
    .use(botsController(botRegistry, messageStore))
    .use(threadsController(messageStore));

  return { app, messageStore, botRegistry };
};
