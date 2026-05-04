import type {
  BotAfterMessageHook,
  BotBeforeMessageHook,
  CoreDbCapability,
  HookContext,
  HookDbCapability,
  PluginAfterMessageHook,
  PluginBeforeMessageHook,
} from "@goodchat/contracts/hooks/types";
import { ChatResponseHookExecutionError } from "./errors";

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

export const runBotBeforeHooks = async ({
  context,
  db,
  hooks,
}: {
  context: HookContext;
  db: CoreDbCapability;
  hooks: BotBeforeMessageHook[];
}): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context, db);
    } catch (error) {
      throw toHookError("before", index, error);
    }
  }
};

export const runPluginBeforeHooks = async ({
  context,
  db,
  hooks,
}: {
  context: HookContext;
  db: HookDbCapability;
  hooks: PluginBeforeMessageHook[];
}): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context, db);
    } catch (error) {
      throw toHookError("before", index, error);
    }
  }
};

export const runBotAfterHooks = async ({
  context,
  db,
  hooks,
  responseText,
}: {
  context: HookContext;
  db: CoreDbCapability;
  hooks: BotAfterMessageHook[];
  responseText: string;
}): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context, { text: responseText }, db);
    } catch (error) {
      throw toHookError("after", index, error);
    }
  }
};

export const runPluginAfterHooks = async ({
  context,
  db,
  hooks,
  responseText,
}: {
  context: HookContext;
  db: HookDbCapability;
  hooks: PluginAfterMessageHook[];
  responseText: string;
}): Promise<void> => {
  for (const [index, hook] of hooks.entries()) {
    try {
      await hook(context, { text: responseText }, db);
    } catch (error) {
      throw toHookError("after", index, error);
    }
  }
};
