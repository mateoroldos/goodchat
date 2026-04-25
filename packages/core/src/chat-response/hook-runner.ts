import type {
  AfterMessageHook,
  BeforeMessageHook,
  HookContext,
} from "@goodchat/contracts/hooks/types";
import { ChatResponseHookExecutionError } from "./errors";

interface RunBeforeHooksInput {
  context: HookContext;
  hooks: BeforeMessageHook[];
}

interface RunAfterHooksInput {
  context: HookContext;
  hooks: AfterMessageHook[];
  responseText: string;
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
}: RunBeforeHooksInput): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context);
    } catch (error) {
      throw toHookError("before", index, error);
    }
  }
};

export const runAfterHooks = async ({
  context,
  hooks,
  responseText,
}: RunAfterHooksInput): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context, { text: responseText });
    } catch (error) {
      throw toHookError("after", index, error);
    }
  }
};
