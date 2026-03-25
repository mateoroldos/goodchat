import type { BotConfig } from "@goodchat/contracts/config/types";
import { createGoodchat } from "@goodchat/core";
import { Elysia } from "elysia";

export const createTestApp = async (bots: BotConfig[] = []) => {
  const botConfig = bots[0];
  const app = new Elysia().get("/", () => "OK");

  if (botConfig) {
    const goodchat = await createGoodchat({
      ...botConfig,
      withDashboard: false,
      isServerless: true,
    });

    app.use(goodchat.app);
  }

  return { app };
};
