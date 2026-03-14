import type { DiscordAdapter } from "@chat-adapter/discord";
import type { Platform } from "@goodchat/core/config/models";
import { Elysia } from "elysia";
import type { BotRegistry } from "../../runtime/bot-registry";

export const webhookChatController = (registry: BotRegistry) => {
  const app = new Elysia({ prefix: "/webhook" });

  app.post("/:botId/:platform", ({ params, request, set }) => {
    const botConfig = registry.getConfig(params.botId);
    if (!botConfig) {
      set.status = 404;
      return { message: "Bot not found" };
    }

    if (!botConfig.platforms.includes(params.platform as Platform)) {
      set.status = 404;
      return { message: "Platform not configured" };
    }

    const runtimeResult = registry.getRuntime(params.botId);
    if (runtimeResult.isErr()) {
      set.status = runtimeResult.error.code === "BOT_NOT_FOUND" ? 404 : 500;
      return { message: runtimeResult.error.message };
    }

    const runtime = runtimeResult.value;

    const webhooks = runtime.gateway.getWebhooks();
    const handler = webhooks[params.platform as keyof typeof webhooks];
    if (!handler) {
      set.status = 404;
      return { message: "Platform webhook not configured" };
    }

    return handler(request);
  });

  app.get("/:botId/discord/gateway", async ({ params, request, set }) => {
    const botConfig = registry.getConfig(params.botId);
    if (!botConfig) {
      set.status = 404;
      return { message: "Bot not found" };
    }

    if (!botConfig.platforms.includes("discord")) {
      set.status = 404;
      return { message: "Discord adapter not configured" };
    }

    const runtimeResult = registry.getRuntime(params.botId);
    if (runtimeResult.isErr()) {
      set.status = runtimeResult.error.code === "BOT_NOT_FOUND" ? 404 : 500;
      return { message: runtimeResult.error.message };
    }

    const runtime = runtimeResult.value;

    const discordAdapter = runtime.gateway.getAdapter(
      "discord"
    ) as DiscordAdapter | null;

    if (!discordAdapter) {
      set.status = 404;
      return { message: "Discord adapter not configured" };
    }

    await runtime.gateway.initialize();

    const url = new URL(request.url);
    const webhookUrl =
      url.searchParams.get("webhookUrl") ??
      `${url.origin}/api/webhook/${params.botId}/discord`;

    return discordAdapter.startGatewayListener(
      {
        waitUntil: (task) => {
          task.catch(() => undefined);
        },
      },
      10 * 60 * 1000,
      undefined,
      webhookUrl
    );
  });

  return app;
};
