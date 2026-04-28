import type { Platform } from "../config/types";
import type { Logger } from "../logger/types";

export interface MessageContext {
  adapterName: string;
  botName: string;
  platform: Platform;
  text: string;
  threadId: string;
  userId: string;
}

export interface BotResponse {
  text: string;
}

export interface HookContext extends MessageContext {
  log: Logger;
}

export type BeforeHookDenyReason =
  | "forbidden"
  | "rate_limited"
  | "validation_failed";

export interface BeforeHookContinueResult {
  action: "continue";
}

export interface BeforeHookDenyResult {
  action: "deny";
  metadata?: Record<string, boolean | number | string>;
  reason: BeforeHookDenyReason;
  retryAfterMs?: number;
  userMessage: string;
}

export type BeforeHookResult =
  | BeforeHookContinueResult
  | BeforeHookDenyResult
  | undefined;

export type AfterMessageHook = (
  context: HookContext,
  response: BotResponse
) => Promise<void>;

export type BeforeMessageHook = (
  context: HookContext
) => Promise<BeforeHookResult>;

export interface GoodchatHooks {
  afterMessage?: AfterMessageHook;
  beforeMessage?: BeforeMessageHook;
}
