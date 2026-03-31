import type { Message, MessageCreate, MessageUpdate } from "./message";
import type { Thread, ThreadCreate, ThreadUpdate } from "./thread";

interface ListCursor {
  createdAt: string;
  id: string;
}

interface ThreadListInput {
  botId: string;
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
}

interface MessageListInput {
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
  threadId: string;
}

export interface Database {
  ensureSchemaVersion: () => Promise<void>;
  messages: {
    create: (input: MessageCreate) => Promise<Message>;
    getById: (id: string) => Promise<Message | null>;
    listByThread: (input: MessageListInput) => Promise<Message[]>;
    update: (id: string, patch: MessageUpdate) => Promise<Message>;
    delete: (id: string) => Promise<void>;
  };
  threads: {
    create: (input: ThreadCreate) => Promise<Thread>;
    getById: (id: string) => Promise<Thread | null>;
    list: (input: ThreadListInput) => Promise<Thread[]>;
    update: (id: string, patch: ThreadUpdate) => Promise<Thread>;
    delete: (id: string) => Promise<void>;
  };
  transaction: <T>(fn: (database: Database) => Promise<T>) => Promise<T>;
}
