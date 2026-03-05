import type { Platform } from "../bot/types";

export interface LogEntry {
  botName: string;
  id: string;
  platform: Platform;
  responseText: string;
  text: string;
  threadId: string;
  timestamp: string;
  userId: string;
}
