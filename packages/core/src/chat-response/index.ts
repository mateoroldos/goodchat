import type { Bot } from "@goodchat/contracts/config/types";
import type {
  HookContext,
  PluginAfterMessageHook,
} from "@goodchat/contracts/hooks/types";
import { Result } from "better-result";
import type { AiResponseService } from "../ai-response/interface";
import type { HookRegistration } from "../extensions/models";
import type { LoggerService } from "../logger/interface";
import type { MessageContext } from "../types";
import {
  ChatResponseGenerationError,
  ChatResponseHookExecutionError,
  ChatResponseInputInvalidError,
} from "./errors";
import {
  createCoreDbCapability,
  createPluginHookCapabilities,
} from "./hook-capabilities";
import { runBotBeforeHooks, runPluginBeforeHooks } from "./hook-runner";
import type { ChatResponseService } from "./interface";
import {
  runBotAfterHooksResilient,
  runPluginAfterHookResilient,
  runStreamPostProcess,
  runSyncPostProcess,
} from "./post-process";

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
  hookRegistrations?: HookRegistration[];
  logger: LoggerService;
}

export class DefaultChatResponseService implements ChatResponseService {
  readonly #aiResponse: AiResponseService;
  readonly #bot: Bot;
  readonly #hookRegistrations: HookRegistration[];
  readonly #logger: LoggerService;

  constructor({
    aiResponse,
    bot,
    hookRegistrations,
    logger,
  }: ChatResponseDependencies) {
    this.#aiResponse = aiResponse;
    this.#bot = bot;
    this.#hookRegistrations = hookRegistrations ?? [];
    this.#logger = logger;
  }

  async handleMessage(context: MessageContext) {
    const inputError = this.#validateInput(context.text);
    if (inputError) {
      return Result.err(inputError);
    }

    try {
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
      await runBotAfterHooksResilient({
        db: createCoreDbCapability(this.#bot.database),
        hookContext,
        hooks: this.#bot.hooks.afterMessage,
        responseText: text,
      });
      await this.#runPluginAfterHooks(hookContext, text);

      this.#setResponseStatus(requestLogger, "success", text.length);

      const backgroundLogger = this.#createBackgroundLogger(
        requestLogger,
        context,
        "sync"
      );

      runSyncPostProcess({
        context,
        database: this.#bot.database,
        logger: backgroundLogger,
        responseText: text,
        setResponseStatus: this.#setResponseStatus.bind(this),
        telemetry,
      }).catch(() => undefined);

      return Result.ok({
        text,
        threadEntryId: context.threadId,
      });
    } catch (error) {
      return Result.err(this.#toResponseError(error));
    }
  }

  async handleMessageStream(context: MessageContext) {
    const inputError = this.#validateInput(context.text);
    if (inputError) {
      return Result.err(inputError);
    }

    try {
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
      runStreamPostProcess({
        buildHookContext: this.#buildHookContext.bind(this),
        context,
        database: this.#bot.database,
        db: createCoreDbCapability(this.#bot.database),
        hooks: this.#bot.hooks.afterMessage,
        logger: backgroundLogger,
        pluginAfterHooks: this.#hookRegistrations.reduce<
          Array<{
            db: ReturnType<typeof createPluginHookCapabilities>;
            hook: PluginAfterMessageHook;
          }>
        >((accumulator, registration) => {
          if (!registration.afterMessage) {
            return accumulator;
          }
          accumulator.push({
            db: createPluginHookCapabilities({
              database: this.#bot.database,
              pluginKey: registration.pluginKey,
              pluginName: registration.pluginName,
              schema: registration.schema,
            }),
            hook: registration.afterMessage,
          });
          return accumulator;
        }, []),
        setResponseStatus: this.#setResponseStatus.bind(this),
        stream: storeStream,
        telemetry: botResponse.value.telemetry,
      }).catch(() => undefined);

      this.#setResponseStatus(requestLogger, "streaming");

      return Result.ok({ uiStream: clientStream });
    } catch (error) {
      return Result.err(this.#toResponseError(error));
    }
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
    await runBotBeforeHooks({
      context: hookContext,
      db: createCoreDbCapability(this.#bot.database),
      hooks: this.#bot.hooks.beforeMessage,
    });
    for (const registration of this.#hookRegistrations) {
      if (!registration.beforeMessage) {
        continue;
      }
      await runPluginBeforeHooks({
        context: hookContext,
        db: createPluginHookCapabilities({
          database: this.#bot.database,
          pluginKey: registration.pluginKey,
          pluginName: registration.pluginName,
          schema: registration.schema,
        }),
        hooks: [registration.beforeMessage],
      });
    }

    logger.set({
      hooks: {
        beforeCount: this.#bot.hooks.beforeMessage.length,
      },
    });
  }

  async #runPluginAfterHooks(hookContext: HookContext, responseText: string) {
    for (const registration of this.#hookRegistrations) {
      if (!registration.afterMessage) {
        continue;
      }
      await runPluginAfterHookResilient({
        db: createPluginHookCapabilities({
          database: this.#bot.database,
          pluginKey: registration.pluginKey,
          pluginName: registration.pluginName,
          schema: registration.schema,
        }),
        hook: registration.afterMessage,
        hookContext,
        responseText,
      });
    }
  }

  #toGenerationError(error: {
    details?: string[];
    message: string;
  }): ChatResponseGenerationError {
    return new ChatResponseGenerationError(error.message, error.details, error);
  }

  #toResponseError(error: unknown) {
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
}
