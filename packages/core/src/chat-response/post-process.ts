import type { Database } from "@goodchat/contracts/database/interface";
import type {
  BotAfterMessageHook,
  CoreDbCapability,
  HookContext,
  HookDbCapability,
  PluginAfterMessageHook,
} from "@goodchat/contracts/hooks/types";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import type { AiRunTelemetry } from "../ai-response/models";
import type { MessageContext } from "../types";
import { ChatResponseHookExecutionError } from "./errors";
import { runBotAfterHooks, runPluginAfterHooks } from "./hook-runner";
import { persistChatResponse } from "./persistence";

interface RunStreamPostProcessInput {
  buildHookContext: (
    context: MessageContext,
    log: HookContext["log"]
  ) => HookContext;
  context: MessageContext;
  database: Database;
  db: CoreDbCapability;
  hooks: BotAfterMessageHook[];
  logger: HookContext["log"];
  pluginAfterHooks: Array<{
    db: HookDbCapability;
    hook: PluginAfterMessageHook;
  }>;
  setResponseStatus: (
    logger: HookContext["log"],
    status: "streaming" | "success",
    responseLength?: number
  ) => void;
  stream: ReadableStream<UIMessageChunk>;
  telemetry: Promise<AiRunTelemetry>;
}

interface RunSyncPostProcessInput {
  context: MessageContext;
  database: Database;
  logger: HookContext["log"];
  responseText: string;
  setResponseStatus: (
    logger: HookContext["log"],
    status: "streaming" | "success",
    responseLength?: number
  ) => void;
  telemetry: AiRunTelemetry;
}

const toError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error(fallbackMessage);
};

const collectAssistantText = async (stream: ReadableStream<UIMessageChunk>) => {
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
};

const persistResponse = async ({
  context,
  database,
  responseText,
  telemetry,
}: {
  context: MessageContext;
  database: Database;
  responseText: string;
  telemetry: AiRunTelemetry;
}) => {
  await persistChatResponse({
    context,
    database,
    responseText,
    telemetry,
  });
};

const warnHookFailure = (hookContext: HookContext, error: unknown): void => {
  const normalized =
    error instanceof ChatResponseHookExecutionError
      ? error
      : new ChatResponseHookExecutionError(
          "afterMessage hook failed",
          "after",
          [],
          error
        );

  hookContext.log.warn("afterMessage hook failed; continuing response flow", {
    error: {
      code: normalized.code,
      fix: "Inspect user-provided afterMessage hooks for uncaught errors.",
      message: normalized.message,
      stage: normalized.stage,
      type: normalized.name,
      why: "Hook execution errors are non-blocking in response post-processing.",
    },
  });
};

export const runBotAfterHooksResilient = async ({
  db,
  hookContext,
  hooks,
  responseText,
  telemetry,
}: {
  db: CoreDbCapability;
  hookContext: HookContext;
  hooks: BotAfterMessageHook[];
  responseText: string;
  telemetry?: AiRunTelemetry;
}): Promise<void> => {
  try {
    await runBotAfterHooks({
      context: hookContext,
      db,
      hooks,
      responseText,
      telemetry,
    });
  } catch (error) {
    warnHookFailure(hookContext, error);
  }
};

export const runPluginAfterHookResilient = async ({
  db,
  hook,
  hookContext,
  responseText,
  telemetry,
}: {
  db: HookDbCapability;
  hook: PluginAfterMessageHook;
  hookContext: HookContext;
  responseText: string;
  telemetry?: AiRunTelemetry;
}): Promise<void> => {
  try {
    await runPluginAfterHooks({
      context: hookContext,
      db,
      hooks: [hook],
      responseText,
      telemetry,
    });
  } catch (error) {
    warnHookFailure(hookContext, error);
  }
};

export const runSyncPostProcess = async ({
  context,
  database,
  logger,
  responseText,
  setResponseStatus,
  telemetry,
}: RunSyncPostProcessInput) => {
  try {
    await persistResponse({
      context,
      database,
      responseText,
      telemetry,
    });
    setResponseStatus(logger, "success", responseText.length);
  } catch (error) {
    logger.error(toError(error, "Failed to persist chat response"), {
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
};

export const runStreamPostProcess = async ({
  buildHookContext,
  context,
  database,
  db,
  hooks,
  logger,
  pluginAfterHooks,
  setResponseStatus,
  stream,
  telemetry,
}: RunStreamPostProcessInput) => {
  try {
    const responseText = await collectAssistantText(stream);
    const resolvedTelemetry = await telemetry;
    const hookContext = buildHookContext(context, logger);
    await runBotAfterHooksResilient({
      db,
      hookContext,
      hooks,
      responseText,
      telemetry: resolvedTelemetry,
    });
    for (const registration of pluginAfterHooks) {
      await runPluginAfterHookResilient({
        db: registration.db,
        hook: registration.hook,
        hookContext,
        responseText,
        telemetry: resolvedTelemetry,
      });
    }
    await persistResponse({
      context,
      database,
      responseText,
      telemetry: resolvedTelemetry,
    });
    setResponseStatus(logger, "success", responseText.length);
  } catch (error) {
    logger.error(toError(error, "Failed to persist streamed chat response"), {
      error: {
        code: "CHAT_RESPONSE_STREAM_PERSISTENCE_FAILED",
        stage: "stream-post-process",
        why: "Streaming response finished but post-processing failed.",
        fix: "Check database connectivity and afterMessage hook behavior.",
      },
    });
  } finally {
    logger.emit();
  }
};
