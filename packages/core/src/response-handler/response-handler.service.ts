import { BotInputInvalidError } from "@goodchat/core/bot/errors";
import type { IncomingMessage } from "@goodchat/core/bot/models";
import type { ResponseGeneratorService } from "@goodchat/core/bot/response-generator.service.interface";
import type { Platform } from "@goodchat/core/config/models";
import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import type { MessageEntry } from "@goodchat/core/message-store/models";
import { Result } from "better-result";
import type {
  ChatEventContext,
  ResponseHandlerService,
  ResponseMessageParams,
} from "./response-handler.service.interface";

interface ResponseHandlerDependencies {
  messageStore: MessageStoreService;
  responseGenerator: ResponseGeneratorService;
}

export class DefaultResponseHandlerService implements ResponseHandlerService {
  readonly #responseGenerator: ResponseGeneratorService;
  readonly #messageStore: MessageStoreService;

  constructor({
    responseGenerator: bot,
    messageStore,
  }: ResponseHandlerDependencies) {
    this.#responseGenerator = bot;
    this.#messageStore = messageStore;
  }

  async handleMessage(
    context: ChatEventContext,
    params: ResponseMessageParams
  ) {
    const platform = resolvePlatform(context);
    if (!platform) {
      return Result.err(
        new BotInputInvalidError("Unsupported platform for chat message")
      );
    }

    const incomingMessage = createIncomingMessage(context, params.text);
    const botResponse = await this.#responseGenerator.generateResponse({
      botConfig: context.botConfig,
      message: incomingMessage,
    });

    if (botResponse.isErr()) {
      return botResponse;
    }

    const logEntry = createMessageEntry(
      context,
      incomingMessage,
      botResponse.value.text
    );

    this.#messageStore.appendLog(logEntry);

    return Result.ok({ text: botResponse.value.text, logId: logEntry.id });
  }
}

const resolvePlatform = (context: ChatEventContext): Platform | null =>
  context.botConfig.platforms.includes(context.platform)
    ? context.platform
    : null;

const createIncomingMessage = (
  context: ChatEventContext,
  text: string
): IncomingMessage => ({
  botName: context.botConfig.name,
  platform: context.platform,
  text,
  threadId: context.threadId,
  userId: context.userId,
});

const createMessageEntry = (
  context: ChatEventContext,
  message: IncomingMessage,
  responseText: string
): MessageEntry => ({
  adapterName: context.adapterName,
  botId: context.botConfig.id,
  botName: context.botConfig.name,
  id: crypto.randomUUID(),
  platform: message.platform,
  responseText,
  text: message.text,
  threadId: message.threadId,
  timestamp: new Date().toISOString(),
  userId: message.userId,
});
