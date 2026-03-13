import type { DiscordAdapter } from "@chat-adapter/discord";
import { BotInputInvalidError } from "@goodchat/core/bot/errors";
import { DefaultResponseGeneratorService } from "@goodchat/core/bot/response-generator.service";
import type { BotConfig, Platform } from "@goodchat/core/config/models";
import { DefaultChatGatewayService } from "@goodchat/core/gateway/chat-gateway.service";
import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { DefaultResponseHandlerService } from "@goodchat/core/response-handler/response-handler.service";
import { Elysia } from "elysia";

export const webhookChatController = (
  botConfig: BotConfig,
  messageStore: MessageStoreService
) => {
  const adapter = new DefaultChatGatewayService({
    botId: botConfig.id,
    userName: botConfig.name,
    platforms: botConfig.platforms,
  });
  const platformIds = adapter.getPlatformIds();

  if (platformIds.length === 0) {
    return null;
  }

  const responseGenerator = new DefaultResponseGeneratorService();
  const responseHandler = new DefaultResponseHandlerService({
    responseGenerator,
    messageStore,
  });

  const DEFAULT_ERROR_MESSAGE = "Sorry, I ran into an error while responding.";

  const resolvePlatform = (threadId: string): Platform | null => {
    const [platform] = threadId.split(":");
    if (!platform) {
      return null;
    }

    return botConfig.platforms.includes(platform as Platform)
      ? (platform as Platform)
      : null;
  };

  adapter.registerHandlers({
    onNewMention: async (thread, message) => {
      await thread.subscribe();

      const platform = resolvePlatform(thread.id);
      if (!platform) {
        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      const result = await responseHandler.handleMessage(
        {
          adapterName: platform,
          botConfig,
          platform,
          threadId: thread.id,
          userId: message.author.userId,
        },
        { text: message.text }
      );

      if (result.isErr()) {
        if (result.error instanceof BotInputInvalidError) {
          await thread.post(DEFAULT_ERROR_MESSAGE);
          return;
        }

        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      await thread.post(result.value.text);
    },
    onSubscribedMessage: async (thread, message) => {
      const platform = resolvePlatform(thread.id);
      if (!platform) {
        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      const result = await responseHandler.handleMessage(
        {
          adapterName: platform,
          botConfig,
          platform,
          threadId: thread.id,
          userId: message.author.userId,
        },
        { text: message.text }
      );

      if (result.isErr()) {
        if (result.error instanceof BotInputInvalidError) {
          await thread.post(DEFAULT_ERROR_MESSAGE);
          return;
        }

        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      await thread.post(result.value.text);
    },
  });

  const webhooks = adapter.getWebhooks();
  const app = new Elysia({ prefix: `/webhook/${botConfig.id}` });

  for (const platform of platformIds) {
    const handler = webhooks[platform as keyof typeof webhooks];
    if (!handler) {
      continue;
    }

    app.post(`/${platform}`, ({ request }) => handler(request));
  }

  if (platformIds.includes("discord")) {
    app.get("/discord/gateway", async ({ request, set }) => {
      const discordAdapter = adapter.getAdapter(
        "discord"
      ) as DiscordAdapter | null;

      if (!discordAdapter) {
        set.status = 404;
        return { message: "Discord adapter not configured" };
      }

      await adapter.initialize();

      const url = new URL(request.url);
      const webhookUrl =
        url.searchParams.get("webhookUrl") ??
        `${url.origin}/api/webhook/${botConfig.id}/discord`;

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
  }

  return app;
};
