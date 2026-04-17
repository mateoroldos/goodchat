import type { Bot } from "@goodchat/contracts/config/types";
import type { Database } from "@goodchat/contracts/database/interface";
import type { MessageCreate } from "@goodchat/contracts/database/message";
import type {
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import type { HookContext } from "@goodchat/contracts/hooks/types";
import type { UIMessageChunk } from "ai";
import { readUIMessageStream } from "ai";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { LoggerService } from "../logger/interface";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseInputInvalidError,
} from "./errors";
import type { ChatResponseService } from "./interface";

interface ChatResponseDependencies {
  aiResponse: AiResponseService;
  bot: Bot;
  logger: LoggerService;
}

export class DefaultChatResponseService implements ChatResponseService {
  readonly #aiResponse: AiResponseService;
  readonly #bot: Bot;
  readonly #logger: LoggerService;

  constructor({ aiResponse, bot, logger }: ChatResponseDependencies) {
    this.#aiResponse = aiResponse;
    this.#bot = bot;
    this.#logger = logger;
  }

  async handleMessage(context: MessageContext) {
    if (!context.text.trim()) {
      return Result.err(
        new ChatResponseInputInvalidError("Message text is required")
      );
    }

    const logger = this.#logger.get();
    const hookContext = this.#buildHookContext(context, logger);
    logger.set({
      message: {
        length: context.text.length,
      },
      request: {
        mode: "sync",
      },
    });

    for (const hook of this.#bot.hooks.beforeMessage) {
      await hook(hookContext);
    }

    logger.set({
      hooks: {
        beforeCount: this.#bot.hooks.beforeMessage.length,
      },
    });

    const botResponse = await this.#aiResponse.generate(
      this.#buildAiParams(context, logger)
    );

    if (botResponse.isErr()) {
      logger.error("Failed to generate chat response", {
        error: {
          code: botResponse.error.code,
          message: botResponse.error.message,
          type: botResponse.error.name,
          why: "The AI provider failed while generating the response.",
          fix: "Check model credentials, model availability, and tool/MCP connectivity.",
        },
      });
      return Result.err(
        new ChatResponseGenerationError(
          botResponse.error.message,
          botResponse.error.details,
          botResponse.error
        )
      );
    }

    for (const hook of this.#bot.hooks.afterMessage) {
      await hook(hookContext, botResponse.value);
    }

    logger.set({
      hooks: {
        afterCount: this.#bot.hooks.afterMessage.length,
      },
      outcome: {
        status: "success",
      },
      response: {
        length: botResponse.value.text.length,
      },
    });

    this.#persistResponse(context, botResponse.value.text).catch((error) => {
      logger.error("Failed to persist chat response", {
        error: {
          code: "CHAT_RESPONSE_PERSISTENCE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
          type: error instanceof Error ? error.name : "UnknownError",
          why: "Chat response was generated but database writes failed.",
          fix: "Check database connectivity and migrations.",
        },
      });
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

    const logger = this.#logger.get();
    const hookContext = this.#buildHookContext(context, logger);
    logger.set({
      message: {
        length: context.text.length,
      },
      request: {
        mode: "stream",
      },
    });

    for (const hook of this.#bot.hooks.beforeMessage) {
      await hook(hookContext);
    }

    logger.set({
      hooks: {
        beforeCount: this.#bot.hooks.beforeMessage.length,
      },
    });

    const botResponse = await this.#aiResponse.stream(
      this.#buildAiParams(context, logger)
    );

    if (botResponse.isErr()) {
      logger.error("Failed to generate streamed chat response", {
        error: {
          code: botResponse.error.code,
          message: botResponse.error.message,
          type: botResponse.error.name,
          why: "The AI provider failed while opening the stream.",
          fix: "Check model credentials, model availability, and tool/MCP connectivity.",
        },
      });
      return Result.err(
        new ChatResponseGenerationError(
          botResponse.error.message,
          botResponse.error.details,
          botResponse.error
        )
      );
    }

    const [clientStream, storeStream] = botResponse.value.uiStream.tee();
    this.#storeStreamResponse(hookContext, storeStream).catch((error) => {
      logger.error("Failed to persist streamed chat response", {
        error: {
          code: "CHAT_RESPONSE_STREAM_PERSISTENCE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
          type: error instanceof Error ? error.name : "UnknownError",
          why: "Streaming response finished but post-processing failed.",
          fix: "Check database connectivity and afterMessage hook behavior.",
        },
      });
    });

    logger.set({
      hooks: {
        afterCount: this.#bot.hooks.afterMessage.length,
      },
      outcome: {
        status: "streaming",
      },
    });

    return Result.ok({ uiStream: clientStream });
  }

  #buildHookContext(
    context: MessageContext,
    log: HookContext["log"]
  ): HookContext {
    log.set({
      platform: context.platform,
      adapter: context.adapterName,
      thread: { id: context.threadId },
      user: { id: context.userId },
    });
    return { ...context, log };
  }

  #buildAiParams(context: MessageContext, logger: HookContext["log"]) {
    const { systemPrompt: promptExtension } = this.#bot;
    const systemPrompt = promptExtension
      ? `${this.#bot.prompt}\n\nBot name: ${this.#bot.name}\n\n${promptExtension}`
      : `${this.#bot.prompt}\n\nBot name: ${this.#bot.name}`;

    logger.set({
      ai: {
        mcpServerCount: this.#bot.mcp?.length ?? 0,
        model: this.#bot.model,
        toolCount: Object.keys(this.#bot.tools ?? {}).length,
      },
    });

    return {
      logger,
      systemPrompt,
      userMessage: context.text,
      tools: this.#bot.tools,
      mcp: this.#bot.mcp,
      model: this.#bot.model,
    };
  }

  async #storeStreamResponse(
    hookContext: HookContext,
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

    for (const hook of this.#bot.hooks.afterMessage) {
      await hook(hookContext, { text: responseText });
    }

    await this.#persistResponse(hookContext, responseText);
  }

  async #persistResponse(context: MessageContext, responseText: string) {
    const timestamp = new Date().toISOString();
    await this.#bot.database.transaction(async (database: Database) => {
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
