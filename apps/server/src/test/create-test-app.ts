import type { BotConfig } from "@goodchat/core/config/models";
import { createGoodbot } from "@goodchat/core/create-goodbot";
import { InMemoryMessageStoreService } from "@goodchat/core/message-store/index";
import { Elysia } from "elysia";

export const createTestApp = async (bots: BotConfig[] = []) => {
  const messageStore = new InMemoryMessageStoreService();
  const botConfig = bots[0];
  const app = new Elysia().get("/", () => "OK");

  if (botConfig) {
    const goodbot = await createGoodbot({
      ...botConfig,
      messageStore,
      withDashboard: false,
      isServerless: true,
    });

    app.use(goodbot.app);
  }

  return { app, messageStore };
};
