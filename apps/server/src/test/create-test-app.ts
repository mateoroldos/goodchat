import type { BotConfig } from "@goodchat/core/config/models";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";
import { botsController } from "../modules/bots";
import { threadsController } from "../modules/threads";

export const createTestApp = (bots: BotConfig[] = []) => {
  const messageStore = new InMemoryMessageStoreService();

  const app = new Elysia()
    .get("/", () => "OK")
    .use(botsController(bots))
    .use(threadsController(messageStore));

  return { app, messageStore };
};
