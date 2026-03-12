import type { LocalAdapterService } from "@goodchat/adapters/local-adapter";
import type { BotService } from "@goodchat/core/bot";
import type { BotConfig } from "@goodchat/core/bot.types";
import type { LogStoreService } from "@goodchat/core/log-store";
import type { LogEntry } from "@goodchat/core/log-store.types";
import { Result } from "better-result";

export const handleLocalWebhook = (
  body: unknown,
  botConfig: BotConfig,
  services: {
    adapter: LocalAdapterService;
    bot: BotService;
    logger: LogStoreService;
  }
) =>
  Result.gen(async function* () {
    const { adapter, bot, logger } = services;

    const message = yield* adapter.parseWebhook(body);

    const botResponse = yield* Result.await(
      bot.sendMessage(message, botConfig)
    );

    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      botName: botConfig.name,
      platform: "local",
      userId: message.userId,
      threadId: message.threadId,
      text: message.text,
      responseText: botResponse.text,
    };

    logger.appendLog(logEntry);

    return Result.ok({ text: botResponse.text, logId: logEntry.id });
  });
