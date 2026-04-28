import type { Database } from "@goodchat/contracts/database/interface";
import type { HookContext } from "@goodchat/contracts/hooks/types";
import type { AiRunTelemetry } from "../ai-response/models";
import type { MessageContext } from "../types";
import { persistChatResponse } from "./persistence";

interface RunPostProcessInput {
  context: MessageContext;
  database: Database;
  logger: HookContext["log"];
  mode: "stream" | "sync";
  responseText: string;
  telemetry: AiRunTelemetry | Promise<AiRunTelemetry>;
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

export const runPostProcess = async ({
  context,
  database,
  logger,
  mode,
  responseText,
  telemetry,
}: RunPostProcessInput) => {
  // Post-processing is non-blocking to user flow: failures are logged only.
  try {
    const resolvedTelemetry = await telemetry;
    await persistChatResponse({
      context,
      database,
      responseText,
      telemetry: resolvedTelemetry,
    });
  } catch (error) {
    if (mode === "sync") {
      logger.error(toError(error, "Failed to persist chat response"), {
        error: {
          code: "CHAT_RESPONSE_PERSISTENCE_FAILED",
          stage: "sync-post-process",
          why: "Chat response was generated but database writes failed.",
          fix: "Check database connectivity and migrations.",
        },
      });
    } else {
      logger.error(toError(error, "Failed to persist streamed chat response"), {
        error: {
          code: "CHAT_RESPONSE_STREAM_PERSISTENCE_FAILED",
          stage: "stream-post-process",
          why: "Streaming response finished but post-processing failed.",
          fix: "Check database connectivity and afterMessage hook behavior.",
        },
      });
    }
  } finally {
    // Always emit post-process telemetry, including failures.
    logger.emit();
  }
};
