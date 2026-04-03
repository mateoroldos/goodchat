import type { Platform } from "../config/types";

export interface Thread {
  adapterName: string;
  botId: string;
  botName: string;
  createdAt: string;
  id: string;
  lastActivityAt: string;
  platform: Platform;
  responseText: string;
  text: string;
  threadId: string;
  updatedAt: string;
  userId: string;
}

export type ThreadCreate = Thread;

export type ThreadUpdate = Partial<
  Pick<
    Thread,
    | "adapterName"
    | "botName"
    | "lastActivityAt"
    | "platform"
    | "responseText"
    | "text"
    | "threadId"
    | "updatedAt"
    | "userId"
  >
>;
