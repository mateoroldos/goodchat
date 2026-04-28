import type {
  AfterMessageHook,
  BeforeHookDenyResult,
  BeforeMessageHook,
  HookContext,
} from "@goodchat/contracts/hooks/types";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import { ChatResponseHookExecutionError } from "./errors";

interface RunBeforeHooksInput {
  context: HookContext;
  hooks: BeforeMessageHook[];
}

interface RunAfterHooksInput {
  context: HookContext;
  hooks: AfterMessageHook[];
  responseText?: string;
  stream?: ReadableStream<UIMessageChunk>;
}

const toHookError = (
  stage: "before" | "after",
  index: number,
  error: unknown
) => {
  const hookPosition = index + 1;
  const message =
    error instanceof Error
      ? error.message
      : `${stage}Message hook ${hookPosition} failed`;

  return new ChatResponseHookExecutionError(
    message,
    stage,
    [`${stage}Message hook #${hookPosition} failed`],
    error
  );
};

export const runBeforeHooks = async ({
  context,
  hooks,
}: RunBeforeHooksInput): Promise<BeforeHookDenyResult | undefined> => {
  // beforeMessage hooks are blocking: deny short-circuits the main pipeline,
  // and thrown errors fail the request as hook execution errors.
  for (const [index, hook] of hooks.entries()) {
    try {
      const result = await hook(context);
      if (result?.action === "deny") {
        return result;
      }
    } catch (error) {
      throw toHookError("before", index, error);
    }
  }

  context.log.set({
    hooks: {
      beforeCount: hooks.length,
    },
  });

  return undefined;
};

export const collectAssistantText = async (
  stream: ReadableStream<UIMessageChunk>
) => {
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

export const runAfterHooks = async ({
  context,
  hooks,
  responseText,
  stream,
}: RunAfterHooksInput): Promise<{ responseText: string }> => {
  // afterMessage hooks can run from either a sync text response or a streamed response.
  // when a stream is provided, we collect the final assistant text first.
  const finalResponseText =
    responseText ?? (stream ? await collectAssistantText(stream) : "");

  if (!finalResponseText) {
    throw new ChatResponseHookExecutionError(
      "afterMessage hook input is required",
      "after",
      ["Provide responseText or stream when running afterMessage hooks"],
      undefined
    );
  }

  try {
    // afterMessage hooks are non-blocking by policy: hook failures are logged as warnings
    // and response persistence continues.
    for (const [index, hook] of hooks.entries()) {
      try {
        await hook(context, { text: finalResponseText });
      } catch (error) {
        throw toHookError("after", index, error);
      }
    }
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

    context.log.warn("afterMessage hook failed; continuing response flow", {
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

  return { responseText: finalResponseText };
};
