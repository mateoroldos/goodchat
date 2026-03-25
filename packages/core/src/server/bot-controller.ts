import type { BotConfig } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";

export const botController = (botConfig: BotConfig) =>
  new Elysia({ prefix: "/bot" }).get("/", () => ({
    id: botConfig.id,
    name: botConfig.name,
    prompt: botConfig.prompt,
    platforms: botConfig.platforms,
  }));
