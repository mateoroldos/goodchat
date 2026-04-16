import type { Bot } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";

type BotControllerConfig = Pick<
  Bot,
  "id" | "name" | "prompt" | "platforms" | "model"
>;

export const botController = (botConfig: BotControllerConfig) =>
  new Elysia({ prefix: "/bot" }).get("/", () => ({
    id: botConfig.id,
    name: botConfig.name,
    prompt: botConfig.prompt,
    platforms: botConfig.platforms,
    model: botConfig.model,
  }));
