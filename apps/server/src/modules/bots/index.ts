import type { BotConfig } from "@goodchat/core/config/models";
import { Elysia } from "elysia";

export const botsController = (bots: BotConfig[]) =>
  new Elysia({ prefix: "/bots" }).get("/", () =>
    bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      platforms: bot.platforms,
    }))
  );
