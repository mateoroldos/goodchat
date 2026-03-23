import type { BotConfig } from "@goodbot/contracts/config/types";
import { createGoodbot } from "@goodbot/core";
import { Elysia } from "elysia";

export const createTestApp = async (bots: BotConfig[] = []) => {
  const botConfig = bots[0];
  const app = new Elysia().get("/", () => "OK");

  if (botConfig) {
    const goodbot = await createGoodbot({
      ...botConfig,
      withDashboard: false,
      isServerless: true,
    });

    app.use(goodbot.app);
  }

  return { app };
};
