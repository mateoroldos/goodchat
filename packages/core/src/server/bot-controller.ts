import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type { Bot, Platform } from "@goodchat/contracts/config/types";
import Elysia, { t } from "elysia";
import { getPlatformStatus } from "./platform-status-service";

type BotControllerConfig = Pick<
  Bot,
  "id" | "name" | "prompt" | "platforms" | "model"
>;

export const botController = (botConfig: BotControllerConfig) =>
  new Elysia({ prefix: "/bot" })
    .get("/", () => ({
      id: botConfig.id,
      name: botConfig.name,
      prompt: botConfig.prompt,
      platforms: botConfig.platforms,
      model: botConfig.model,
    }))
    .get(
      "/platforms/:name/status",
      ({ params, status }) => {
        if (!(CHAT_PLATFORMS as readonly string[]).includes(params.name)) {
          return status(404, { message: "Unknown platform" });
        }
        return getPlatformStatus(
          params.name as Platform,
          process.env as Record<string, string | undefined>
        );
      },
      { params: t.Object({ name: t.String() }) }
    );
