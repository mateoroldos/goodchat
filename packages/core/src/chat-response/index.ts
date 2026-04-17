import type { Bot } from "@goodchat/contracts/config/types";
import type { HookContext } from "@goodchat/contracts/hooks/types";
import type { UIMessageChunk } from "ai";
import { readUIMessageStream } from "ai";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { AiRunTelemetry } from "../ai-response/models";
import type { LoggerService } from "../logger/interface";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseInputInvalidError,
} from "./errors";
import type { ChatResponseService } from "./interface";
import { persistChatResponse } from "./persistence";

type ChatResponseMode = "stream" | "sync";

const MODE_META = {
  stream: {
    aiFailureMessage: "Failed to generate streamed chat response",
    aiFailureWhy: "The AI provider failed while opening the stream.",
  },
  sync: {
    aiFailureMessage: "Failed to generate chat response",
    aiFailureWhy: "The AI provider failed while generating the response.",
  },
} as const;

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
    const inputError = this.#validateInput(context.text);
    if (inputError) {
      return Result.err(inputError);
    }

    const { hookContext, requestLogger } = await this.#prepareRequest(
      context,
      "sync"
    );

    const botResponse = await this.#aiResponse.generate(
      this.#buildAiParams(context, requestLogger, "sync")
    );

    if (botResponse.isErr()) {
      this.#logAiFailure(requestLogger, botResponse.error, "sync");
      return Result.err(this.#toGenerationError(botResponse.error));
    }

    const { telemetry, text } = botResponse.value;
    await this.#runAfterHooks(hookContext, text);

    this.#setResponseStatus(requestLogger, "success", text.length);

    const backgroundLogger = this.#createBackgroundLogger(
      requestLogger,
      context,
      "sync"
    );

    this.#runSyncPostProcess(context, text, telemetry, backgroundLogger).catch(
      () => undefined
    );

    return Result.ok({
      text,
      threadEntryId: context.threadId,
    });
  }

  async handleMessageStream(context: MessageContext) {
    const inputError = this.#validateInput(context.text);
    if (inputError) {
      return Result.err(inputError);
    }

    const { requestLogger } = await this.#prepareRequest(context, "stream");

    const botResponse = await this.#aiResponse.stream(
      this.#buildAiParams(context, requestLogger, "stream")
    );

    if (botResponse.isErr()) {
      this.#logAiFailure(requestLogger, botResponse.error, "stream");
      return Result.err(this.#toGenerationError(botResponse.error));
    }

    const [clientStream, storeStream] = botResponse.value.uiStream.tee();
    const backgroundLogger = this.#createBackgroundLogger(
      requestLogger,
      context,
      "stream"
    );
    this.#runStreamPostProcess(
      context,
      storeStream,
      botResponse.value.telemetry,
      backgroundLogger
    ).catch(() => undefined);

    this.#setResponseStatus(requestLogger, "streaming");

    return Result.ok({ uiStream: clientStream });
  }

  #validateInput(text: string): ChatResponseInputInvalidError | undefined {
    if (text.trim()) {
      return undefined;
    }

    return new ChatResponseInputInvalidError("Message text is required");
  }

  async #prepareRequest(
    context: MessageContext,
    mode: ChatResponseMode
  ): Promise<{ hookContext: HookContext; requestLogger: HookContext["log"] }> {
    const requestLogger = this.#createRequestLogger(context, mode);
    const hookContext = this.#buildHookContext(context, requestLogger);
    await this.#runBeforeHooks(hookContext, requestLogger);
    return { hookContext, requestLogger };
  }

  #logAiFailure(
    logger: HookContext["log"],
    error: { code: string; message: string; name: string },
    mode: ChatResponseMode
  ) {
    const meta = MODE_META[mode];

    logger.error(meta.aiFailureMessage, {
      error: {
        code: error.code,
        message: error.message,
        type: error.name,
        why: meta.aiFailureWhy,
        fix: "Check model credentials, model availability, and tool/MCP connectivity.",
      },
    });
  }

  #createRequestLogger(context: MessageContext, mode: ChatResponseMode) {
    const logger = this.#logger.request();
    logger.set({
      message: {
        length: context.text.length,
      },
      request: {
        mode,
      },
    });
    return logger;
  }

  async #runBeforeHooks(hookContext: HookContext, logger: HookContext["log"]) {
    for (const hook of this.#bot.hooks.beforeMessage) {
      await hook(hookContext);
    }

    logger.set({
      hooks: {
        beforeCount: this.#bot.hooks.beforeMessage.length,
      },
    });
  }

  async #runAfterHooks(hookContext: HookContext, responseText: string) {
    for (const hook of this.#bot.hooks.afterMessage) {
      await hook(hookContext, { text: responseText });
    }
  }

  #toGenerationError(error: {
    details?: string[];
    message: string;
  }): ChatResponseGenerationError {
    return new ChatResponseGenerationError(error.message, error.details, error);
  }

  #createBackgroundLogger(
    requestLogger: HookContext["log"],
    context: MessageContext,
    mode: ChatResponseMode
  ) {
    const requestContext = requestLogger.getContext();
    const requestId =
      typeof requestContext.requestId === "string"
        ? requestContext.requestId
        : undefined;
    const logger = this.#logger.wide({
      mode,
      ...(requestId ? { parentRequestId: requestId } : {}),
      operation: "chat-response-post-process",
      thread: { id: context.threadId },
      user: { id: context.userId },
    });
    logger.set({
      adapter: context.adapterName,
      platform: context.platform,
    });
    return logger;
  }

  #buildHookContext(
    context: MessageContext,
    log: HookContext["log"]
  ): HookContext {
    log.set({
      platform: context.platform,
      adapter: context.adapterName,
    });
    return { ...context, log };
  }

  #buildAiParams(
    context: MessageContext,
    logger: HookContext["log"],
    mode: ChatResponseMode
  ) {
    return {
      logger,
      mode,
      systemPrompt: this.#buildSystemPrompt(),
      threadId: context.threadId,
      userMessage: context.text,
      userId: context.userId,
      tools: this.#bot.tools,
      mcp: this.#bot.mcp,
      model: this.#bot.model,
    };
  }

  #buildSystemPrompt() {
    const { systemPrompt: promptExtension } = this.#bot;
    const basePrompt = `${this.#bot.prompt}\n\nBot name: ${this.#bot.name}`;
    if (!promptExtension) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${promptExtension}`;
  }

  #setResponseStatus(
    logger: HookContext["log"],
    status: "streaming" | "success",
    responseLength?: number
  ) {
    logger.set({
      hooks: {
        afterCount: this.#bot.hooks.afterMessage.length,
      },
      outcome: {
        status,
      },
      ...(typeof responseLength === "number"
        ? {
            response: {
              length: responseLength,
            },
          }
        : {}),
    });
  }

  async #runSyncPostProcess(
    context: MessageContext,
    responseText: string,
    telemetry: AiRunTelemetry,
    logger: HookContext["log"]
  ) {
    try {
      await this.#persistResponse(context, responseText, telemetry);
      this.#setResponseStatus(logger, "success", responseText.length);
    } catch (error) {
      logger.error(this.#toError(error, "Failed to persist chat response"), {
        error: {
          code: "CHAT_RESPONSE_PERSISTENCE_FAILED",
          stage: "sync-post-process",
          why: "Chat response was generated but database writes failed.",
          fix: "Check database connectivity and migrations.",
        },
      });
    } finally {
      logger.emit();
    }
  }

  async #runStreamPostProcess(
    context: MessageContext,
    stream: ReadableStream<UIMessageChunk>,
    telemetry: Promise<AiRunTelemetry>,
    logger: HookContext["log"]
  ) {
    try {
      const responseText = await this.#collectAssistantText(stream);
      const hookContext = this.#buildHookContext(context, logger);
      await this.#runAfterHooks(hookContext, responseText);
      await this.#persistResponse(context, responseText, await telemetry);
      this.#setResponseStatus(logger, "success", responseText.length);
    } catch (error) {
      logger.error(
        this.#toError(error, "Failed to persist streamed chat response"),
        {
          error: {
            code: "CHAT_RESPONSE_STREAM_PERSISTENCE_FAILED",
            stage: "stream-post-process",
            why: "Streaming response finished but post-processing failed.",
            fix: "Check database connectivity and afterMessage hook behavior.",
          },
        }
      );
    } finally {
      logger.emit();
    }
  }

  #toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === "string") {
      return new Error(error);
    }

    return new Error(fallbackMessage);
  }

  async #collectAssistantText(stream: ReadableStream<UIMessageChunk>) {
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
    return responseText;
  }

  async #persistResponse(
    context: MessageContext,
    responseText: string,
    telemetry: AiRunTelemetry
  ) {
    await persistChatResponse({
      context,
      database: this.#bot.database,
      responseText,
      telemetry,
    });
  }
}
