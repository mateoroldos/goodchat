import type { Platform } from "../config/types";
import type { Logger } from "../logger/types";

export interface MessageContext {
  adapterName: string;
  botId: string;
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

export type AfterMessageHook = (
  context: HookContext,
  response: BotResponse
) => Promise<void>;

export type BeforeMessageHook = (context: HookContext) => Promise<void>;

export interface GoodchatHooks {
  afterMessage?: AfterMessageHook;
  beforeMessage?: BeforeMessageHook;
}
