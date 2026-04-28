import type { Platform } from "../config/types";

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
