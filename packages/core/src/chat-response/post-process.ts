import type { Database } from "@goodchat/contracts/database/interface";
import type {
  AfterMessageHook,
  HookContext,
} from "@goodchat/contracts/hooks/types";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import type { AiRunTelemetry } from "../ai-response/models";
import type { MessageContext } from "../types";
import { ChatResponseHookExecutionError } from "./errors";
import { runAfterHooks } from "./hook-runner";
import { persistChatResponse } from "./persistence";

interface RunAfterHooksResilientInput {
  hookContext: HookContext;
  hooks: AfterMessageHook[];
  responseText: string;
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

interface RunStreamPostProcessInput {
  buildHookContext: (
    context: MessageContext,
    log: HookContext["log"]
  ) => HookContext;
  context: MessageContext;
  database: Database;
  hooks: AfterMessageHook[];
  logger: HookContext["log"];
  setResponseStatus: (
    logger: HookContext["log"],
    status: "streaming" | "success",
    responseLength?: number
  ) => void;
  stream: ReadableStream<UIMessageChunk>;
  telemetry: Promise<AiRunTelemetry>;
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

export const runAfterHooksResilient = async ({
  hookContext,
  hooks,
  responseText,
}: RunAfterHooksResilientInput): Promise<void> => {
  try {
    await runAfterHooks({
      context: hookContext,
      hooks,
      responseText,
    });
  } catch (error) {
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
  hooks,
  logger,
  setResponseStatus,
  stream,
  telemetry,
}: RunStreamPostProcessInput) => {
  try {
    const responseText = await collectAssistantText(stream);
    const hookContext = buildHookContext(context, logger);
    await runAfterHooksResilient({
      hookContext,
      hooks,
      responseText,
    });
    await persistResponse({
      context,
      database,
      responseText,
      telemetry: await telemetry,
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
