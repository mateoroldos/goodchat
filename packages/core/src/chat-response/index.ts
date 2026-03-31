import type { BotConfig } from "@goodchat/contracts/config/types";
import type { Database } from "@goodchat/contracts/database/interface";
import type { MessageCreate } from "@goodchat/contracts/database/message";
import type {
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import type { UIMessageChunk } from "ai";
import { readUIMessageStream } from "ai";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { GoodchatExtensions } from "../extensions/models";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseInputInvalidError,
} from "./errors";
import type { ChatResponseService } from "./interface";

interface ChatResponseDependencies {
  aiResponse: AiResponseService;
  botConfig: BotConfig;
  database: Database;
  extensions: GoodchatExtensions;
}

export class DefaultChatResponseService implements ChatResponseService {
  readonly #aiResponse: AiResponseService;
  readonly #botConfig: BotConfig;
  readonly #database: Database;
  readonly #extensions: GoodchatExtensions;

  constructor({
    aiResponse,
    botConfig,
    database,
    extensions,
  }: ChatResponseDependencies) {
    this.#aiResponse = aiResponse;
    this.#botConfig = botConfig;
    this.#database = database;
    this.#extensions = extensions;
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

    this.#persistResponse(context, botResponse.value.text).catch((error) => {
      console.error("Failed to persist chat response", error);
    });

    return Result.ok({
      text: botResponse.value.text,
      threadEntryId: context.threadId,
    });
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
      model: this.#botConfig.model,
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

    await this.#persistResponse(context, responseText);
  }

  async #persistResponse(context: MessageContext, responseText: string) {
    const timestamp = new Date().toISOString();
    await this.#database.transaction(async (database: Database) => {
      const threadId = context.threadId;
      const existingThread = await database.threads.getById(threadId);
      if (existingThread) {
        const patch: ThreadUpdate = {
          adapterName: context.adapterName,
          botName: context.botName,
          lastActivityAt: timestamp,
          platform: context.platform,
          responseText,
          text: context.text,
          threadId: context.threadId,
          updatedAt: timestamp,
          userId: context.userId,
        };
        await database.threads.update(threadId, patch);
      } else {
        const thread: ThreadCreate = {
          adapterName: context.adapterName,
          botId: context.botId,
          botName: context.botName,
          createdAt: timestamp,
          id: threadId,
          lastActivityAt: timestamp,
          platform: context.platform,
          responseText,
          text: context.text,
          threadId: context.threadId,
          updatedAt: timestamp,
          userId: context.userId,
        };
        await database.threads.create(thread);
      }

      const userMessage: MessageCreate = {
        adapterName: context.adapterName,
        createdAt: timestamp,
        id: crypto.randomUUID(),
        role: "user",
        text: context.text,
        threadId,
        userId: context.userId,
      };
      await database.messages.create(userMessage);

      const assistantMessage: MessageCreate = {
        adapterName: context.adapterName,
        createdAt: timestamp,
        id: crypto.randomUUID(),
        role: "assistant",
        text: responseText,
        threadId,
        userId: context.botId,
      };
      await database.messages.create(assistantMessage);
    });
  }
}
