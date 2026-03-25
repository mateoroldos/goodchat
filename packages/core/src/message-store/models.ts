import type { Platform } from "@goodchat/contracts/config/types";

export interface MessageEntry {
  adapterName: string;
  botId: string;
  botName: string;
  id: string;
  platform: Platform;
  responseText: string;
  text: string;
  threadId: string;
  timestamp: string;
  userId: string;
}
