import type { Platform } from "../config/types";

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

export interface GoodbotHooks {
  afterMessage?: (
    message: MessageContext,
    response: BotResponse
  ) => Promise<void>;
  beforeMessage?: (message: MessageContext) => Promise<void>;
}
