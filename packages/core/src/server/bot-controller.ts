import { Elysia } from "elysia";
import type { BotConfig } from "../config/models";

export const botController = (botConfig: BotConfig) =>
  new Elysia({ prefix: "/bot" }).get("/", () => ({
    id: botConfig.id,
    name: botConfig.name,
    prompt: botConfig.prompt,
    platforms: botConfig.platforms,
  }));
