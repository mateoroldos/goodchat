import type { BotConfig } from "@goodchat/contracts/config/types";
import type { UIMessageChunk } from "ai";
import { readUIMessageStream } from "ai";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { GoodchatExtensions } from "../extensions/models";
import type { MessageStoreService } from "../message-store/interface";
import type { MessageEntry } from "../message-store/models";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseInputInvalidError,
} from "./errors";
import type { ChatResponseService } from "./interface";

interface ChatResponseDependencies {
  aiResponse: AiResponseService;
  botConfig: BotConfig;
  extensions: GoodchatExtensions;
  messageStore: MessageStoreService;
}

export class DefaultChatResponseService implements ChatResponseService {
  readonly #aiResponse: AiResponseService;
  readonly #botConfig: BotConfig;
  readonly #extensions: GoodchatExtensions;
  readonly #messageStore: MessageStoreService;

  constructor({
    aiResponse,
    botConfig,
    extensions,
    messageStore,
  }: ChatResponseDependencies) {
    this.#aiResponse = aiResponse;
    this.#botConfig = botConfig;
    this.#extensions = extensions;
    this.#messageStore = messageStore;
  }

  async handleMessage(context: MessageContext) {
    if (!context.text.trim()) {
      return Result.err(
        new ChatResponseInputInvalidError("Message text is required")
      );
    }

    for (const hook of this.#extensions.beforeMessageHooks) {
      await hook(context);
    }

    const botResponse = await this.#aiResponse.generate(
      this.#buildAiParams(context)
    );

    if (botResponse.isErr()) {
      return Result.err(
        new ChatResponseGenerationError(
          botResponse.error.message,
          botResponse.error.details,
          botResponse.error
        )
      );
    }

    for (const hook of this.#extensions.afterMessageHooks) {
      await hook(context, botResponse.value);
    }

    const entry = this.#createMessageEntry(context, botResponse.value.text);
    this.#messageStore.appendThread(entry);

    return Result.ok({ text: botResponse.value.text, threadEntryId: entry.id });
  }

  async handleMessageStream(context: MessageContext) {
    if (!context.text.trim()) {
      return Result.err(
        new ChatResponseInputInvalidError("Message text is required")
      );
    }

    for (const hook of this.#extensions.beforeMessageHooks) {
      await hook(context);
    }

    const botResponse = await this.#aiResponse.stream(
      this.#buildAiParams(context)
    );

    if (botResponse.isErr()) {
      return Result.err(
        new ChatResponseGenerationError(
          botResponse.error.message,
          botResponse.error.details,
          botResponse.error
        )
      );
    }

    const [clientStream, storeStream] = botResponse.value.uiStream.tee();
    this.#storeStreamResponse(context, storeStream).catch(() => undefined);

    return Result.ok({ uiStream: clientStream });
  }

  #buildAiParams(context: MessageContext) {
    const { systemPrompt: promptExtension } = this.#extensions;
    const systemPrompt = promptExtension
      ? `${this.#botConfig.prompt}\n\nBot name: ${this.#botConfig.name}\n\n${promptExtension}`
      : `${this.#botConfig.prompt}\n\nBot name: ${this.#botConfig.name}`;

    return {
      systemPrompt,
      userMessage: context.text,
      tools: this.#extensions.tools,
      mcp: this.#extensions.mcp,
    };
  }

  async #storeStreamResponse(
    context: MessageContext,
    stream: ReadableStream<UIMessageChunk>
  ) {
    let responseText = "";
    for await (const uiMessage of readUIMessageStream({ stream })) {
      if (uiMessage.role !== "assistant") {
        continue;
      }
      responseText = uiMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    }

    for (const hook of this.#extensions.afterMessageHooks) {
      await hook(context, { text: responseText });
    }

    this.#messageStore.appendThread(
      this.#createMessageEntry(context, responseText)
    );
  }

  #createMessageEntry(
    context: MessageContext,
    responseText: string
  ): MessageEntry {
    return {
      adapterName: context.adapterName,
      botId: this.#botConfig.id,
      botName: this.#botConfig.name,
      id: crypto.randomUUID(),
      platform: context.platform,
      responseText,
      text: context.text,
      threadId: context.threadId,
      timestamp: new Date().toISOString(),
      userId: context.userId,
    };
  }
}
