import type { Bot } from "@goodchat/contracts/config/types";
import type {
  BeforeHookDenyResult,
  HookContext,
} from "@goodchat/contracts/hooks/types";
import type { UIMessageChunk } from "ai";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { AiRunTelemetry } from "../ai-response/models";
import type { LoggerService } from "../logger/interface";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseHookExecutionError,
  ChatResponseInputInvalidError,
} from "./errors";
import { runAfterHooks, runBeforeHooks } from "./hook-runner";
import type { ChatResponseService } from "./interface";
import { runPostProcess } from "./post-process";

type Mode = "stream" | "sync";

type PreflightResult =
  | { proceed: true; hookContext: HookContext; logger: HookContext["log"] }
  | { proceed: false; denied: BeforeHookDenyResult };

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
    try {
      const preflight = await this.#preflight(context, "sync");
      if (preflight.isErr()) {
        return Result.err(preflight.error);
      }
      if (!preflight.value.proceed) {
        return Result.ok(preflight.value.denied);
      }

      const { hookContext, logger } = preflight.value;

      const response = await this.#aiResponse.generate(
        this.#aiParams(context, logger, "sync")
      );
      if (response.isErr()) {
        this.#logAiFailure(logger, response.error, "sync");
        return Result.err(this.#toGenerationError(response.error));
      }

      const { text, telemetry } = response.value;
      await runAfterHooks({
        context: hookContext,
        hooks: this.#bot.hooks.afterMessage,
        responseText: text,
      });

      this.#logStatus(logger, "success", text.length);

      const bgLogger = this.#backgroundLogger(logger, context, "sync");
      this.#background(
        runPostProcess({
          context,
          database: this.#bot.database,
          logger: bgLogger,
          mode: "sync",
          responseText: text,
          telemetry,
        }),
        bgLogger,
        "sync-post-process"
      );

      return Result.ok({
        action: "respond" as const,
        text,
        threadEntryId: context.threadId,
      });
    } catch (error) {
      return Result.err(this.#toError(error));
    }
  }

  async handleMessageStream(context: MessageContext) {
    try {
      const preflight = await this.#preflight(context, "stream");
      if (preflight.isErr()) {
        return Result.err(preflight.error);
      }
      if (!preflight.value.proceed) {
        return Result.ok(preflight.value.denied);
      }

      const { logger } = preflight.value;

      const response = await this.#aiResponse.stream(
        this.#aiParams(context, logger, "stream")
      );
      if (response.isErr()) {
        this.#logAiFailure(logger, response.error, "stream");
        return Result.err(this.#toGenerationError(response.error));
      }

      const [clientStream, postProcessStream] = response.value.uiStream.tee();
      const bgLogger = this.#backgroundLogger(logger, context, "stream");

      this.#background(
        this.#streamPostProcess({
          context,
          logger: bgLogger,
          stream: postProcessStream,
          telemetry: response.value.telemetry,
        }),
        bgLogger,
        "stream-post-process"
      );

      this.#logStatus(logger, "streaming");

      return Result.ok({ action: "respond" as const, uiStream: clientStream });
    } catch (error) {
      return Result.err(this.#toError(error));
    }
  }

  async #preflight(
    context: MessageContext,
    mode: Mode
  ): Promise<Result<PreflightResult, ChatResponseInputInvalidError>> {
    if (!context.text.trim()) {
      return Result.err(
        new ChatResponseInputInvalidError("Message text is required")
      );
    }

    const logger = this.#requestLogger(context, mode);
    logger.set({ platform: context.platform, adapter: context.adapterName });
    const hookContext: HookContext = { ...context, log: logger };

    const denied = await runBeforeHooks({
      context: hookContext,
      hooks: this.#bot.hooks.beforeMessage,
    });

    if (denied) {
      return Result.ok({ proceed: false, denied });
    }

    return Result.ok({ proceed: true, hookContext, logger });
  }

  async #streamPostProcess({
    context,
    logger,
    stream,
    telemetry,
  }: {
    context: MessageContext;
    logger: HookContext["log"];
    stream: ReadableStream<UIMessageChunk>;
    telemetry: Promise<AiRunTelemetry>;
  }): Promise<void> {
    const hookContext: HookContext = { ...context, log: logger };

    const { responseText } = await runAfterHooks({
      context: hookContext,
      hooks: this.#bot.hooks.afterMessage,
      stream,
    });

    await runPostProcess({
      context,
      database: this.#bot.database,
      logger,
      mode: "stream",
      responseText,
      telemetry,
    });

    this.#logStatus(logger, "success", responseText.length);
  }

  #background(
    task: Promise<void>,
    logger: HookContext["log"],
    stage: "stream-post-process" | "sync-post-process"
  ) {
    // Background failures are logged and intentionally not propagated to the
    // request flow because response delivery already completed.
    task.catch((error: unknown) => {
      logger.warn("Background post-process failed", {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stage,
        },
      });
    });
  }

  #requestLogger(context: MessageContext, mode: Mode) {
    const logger = this.#logger.request();
    logger.set({
      message: { length: context.text.length },
      request: { mode },
    });
    return logger;
  }

  #backgroundLogger(
    requestLogger: HookContext["log"],
    context: MessageContext,
    mode: Mode
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
    logger.set({ adapter: context.adapterName, platform: context.platform });
    return logger;
  }

  #aiParams(context: MessageContext, logger: HookContext["log"], mode: Mode) {
    return {
      logger,
      mode,
      systemPrompt: this.#systemPrompt(),
      threadId: context.threadId,
      userMessage: context.text,
      userId: context.userId,
      tools: this.#bot.tools,
      mcp: this.#bot.mcp,
      model: this.#bot.model,
    };
  }

  #systemPrompt() {
    const { systemPrompt: extension } = this.#bot;
    const base = `${this.#bot.prompt}\n\nBot name: ${this.#bot.name}`;
    return extension ? `${base}\n\n${extension}` : base;
  }

  #logAiFailure(
    logger: HookContext["log"],
    error: { code: string; message: string; name: string },
    mode: Mode
  ) {
    const isStream = mode === "stream";
    logger.error(
      isStream
        ? "Failed to generate streamed chat response"
        : "Failed to generate chat response",
      {
        error: {
          code: error.code,
          message: error.message,
          type: error.name,
          why: isStream
            ? "The AI provider failed while opening the stream."
            : "The AI provider failed while generating the response.",
          fix: "Check model credentials, model availability, and tool/MCP connectivity.",
        },
      }
    );
  }

  #logStatus(
    logger: HookContext["log"],
    status: "streaming" | "success",
    responseLength?: number
  ) {
    logger.set({
      hooks: { afterCount: this.#bot.hooks.afterMessage.length },
      outcome: { status },
      ...(typeof responseLength === "number"
        ? { response: { length: responseLength } }
        : {}),
    });
  }

  #toGenerationError(error: {
    details?: string[];
    message: string;
  }): ChatResponseGenerationError {
    return new ChatResponseGenerationError(error.message, error.details, error);
  }

  #toError(error: unknown) {
    if (
      error instanceof ChatResponseInputInvalidError ||
      error instanceof ChatResponseGenerationError ||
      error instanceof ChatResponseHookExecutionError
    ) {
      return error;
    }

    if (error instanceof Error) {
      return new ChatResponseGenerationError(error.message, [], error);
    }

    return new ChatResponseGenerationError("Failed to generate response", []);
  }
}
