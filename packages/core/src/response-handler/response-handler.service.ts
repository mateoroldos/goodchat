import type { Platform } from "@goodbot/core/config/models";
import type { MessageStoreService } from "@goodbot/core/message-store/message-store.service.interface";
import type { MessageEntry } from "@goodbot/core/message-store/models";
import { BotInputInvalidError } from "@goodbot/core/response-handler/errors";
import type { IncomingMessage } from "@goodbot/core/response-handler/models";
import type { ResponseGeneratorService } from "@goodbot/core/response-handler/response-generator.service.interface";
import { readUIMessageStream } from "ai";
import { Result } from "better-result";
import type { GoodbotExtensions } from "../plugins/models";
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
    params: ResponseMessageParams,
    extensions?: GoodbotExtensions
  ) {
    const platform = resolvePlatform(context);
    if (!platform) {
      return Result.err(
        new BotInputInvalidError("Unsupported platform for chat message")
      );
    }

    const incomingMessage = createIncomingMessage(context, params.text);

    if (extensions) {
      for (const hook of extensions.beforeMessageHooks) {
        await hook(context, incomingMessage);
      }
    }

    const botResponse = await this.#responseGenerator.generateResponse({
      botConfig: context.botConfig,
      message: incomingMessage,
      runtime: extensions
        ? {
            mcp: extensions.mcp,
            systemPromptExtensions: extensions.systemPrompt || undefined,
            tools: extensions.tools,
          }
        : undefined,
    });

    if (botResponse.isErr()) {
      return botResponse;
    }

    if (extensions) {
      for (const hook of extensions.afterMessageHooks) {
        await hook(context, incomingMessage, botResponse.value);
      }
    }

    const threadEntry = createMessageEntry(
      context,
      incomingMessage,
      botResponse.value.text
    );

    this.#messageStore.appendThread(threadEntry);

    return Result.ok({
      text: botResponse.value.text,
      threadEntryId: threadEntry.id,
    });
  }

  async handleMessageStream(
    context: ChatEventContext,
    params: ResponseMessageParams,
    extensions?: GoodbotExtensions
  ) {
    const platform = resolvePlatform(context);
    if (!platform) {
      return Result.err(
        new BotInputInvalidError("Unsupported platform for chat message")
      );
    }

    const incomingMessage = createIncomingMessage(context, params.text);

    if (extensions) {
      for (const hook of extensions.beforeMessageHooks) {
        await hook(context, incomingMessage);
      }
    }

    const botResponse = await this.#responseGenerator.streamResponse({
      botConfig: context.botConfig,
      message: incomingMessage,
      runtime: extensions
        ? {
            mcp: extensions.mcp,
            systemPromptExtensions: extensions.systemPrompt || undefined,
            tools: extensions.tools,
          }
        : undefined,
    });

    if (botResponse.isErr()) {
      return botResponse;
    }

    const [clientStream, storeStream] = botResponse.value.uiStream.tee();

    const storeResponse = async () => {
      let responseText = "";
      for await (const uiMessage of readUIMessageStream({
        stream: storeStream,
      })) {
        if (uiMessage.role !== "assistant") {
          continue;
        }

        responseText = uiMessage.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");
      }

      if (extensions) {
        for (const hook of extensions.afterMessageHooks) {
          await hook(context, incomingMessage, { text: responseText });
        }
      }

      const threadEntry = createMessageEntry(
        context,
        incomingMessage,
        responseText
      );
      this.#messageStore.appendThread(threadEntry);
    };

    storeResponse().catch(() => undefined);

    return Result.ok({ uiStream: clientStream });
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
