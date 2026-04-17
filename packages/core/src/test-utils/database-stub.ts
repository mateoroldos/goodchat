import type {
  AiRun,
  AiRunCreate,
  AiRunUpdate,
} from "@goodchat/contracts/database/ai-run";
import type {
  AiRunToolCall,
  AiRunToolCallCreate,
  AiRunToolCallUpdate,
} from "@goodchat/contracts/database/ai-run-tool-call";
import type { Database } from "@goodchat/contracts/database/interface";
import type {
  Message,
  MessageCreate,
  MessageUpdate,
} from "@goodchat/contracts/database/message";
import type {
  Thread,
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";

const compareByCreatedAt =
  (direction: "asc" | "desc") =>
  (
    left: { createdAt: string; id: string },
    right: { createdAt: string; id: string }
  ) => {
    if (left.createdAt === right.createdAt) {
      return direction === "asc"
        ? left.id.localeCompare(right.id)
        : right.id.localeCompare(left.id);
    }
    return direction === "asc"
      ? left.createdAt.localeCompare(right.createdAt)
      : right.createdAt.localeCompare(left.createdAt);
  };

const applyCursor = <T extends { createdAt: string; id: string }>(
  items: T[],
  cursor: { createdAt: string; id: string } | undefined,
  sort: "asc" | "desc"
) => {
  if (!cursor) {
    return items;
  }

  return items.filter((item) => {
    if (item.createdAt === cursor.createdAt) {
      return sort === "asc" ? item.id > cursor.id : item.id < cursor.id;
    }
    return sort === "asc"
      ? item.createdAt > cursor.createdAt
      : item.createdAt < cursor.createdAt;
  });
};

export const createDatabaseStub = (): Database => {
  const threadStore = new Map<string, Thread>();
  const messageStore = new Map<string, Message>();
  const aiRunStore = new Map<string, AiRun>();
  const aiRunToolCallStore = new Map<string, AiRunToolCall>();

  const database: Database = {
    dialect: "sqlite",
    aiRuns: {
      create: (input: AiRunCreate) => {
        aiRunStore.set(input.id, input);
        return Promise.resolve(input);
      },
      getById: (id: string) => Promise.resolve(aiRunStore.get(id) ?? null),
      listByThread: (
        input: Parameters<Database["aiRuns"]["listByThread"]>[0]
      ) => {
        const sort = input.sort ?? "desc";
        const limit = input.limit ?? 50;
        const aiRuns = Array.from(aiRunStore.values()).filter(
          (aiRun) => aiRun.threadId === input.threadId
        );
        const sorted = applyCursor(
          aiRuns.sort(compareByCreatedAt(sort)),
          input.cursor,
          sort
        );
        return Promise.resolve(sorted.slice(0, limit));
      },
      update: (id: string, patch: AiRunUpdate) => {
        const existing = aiRunStore.get(id);
        if (!existing) {
          return Promise.reject(new Error(`AI run not found: ${id}`));
        }
        const updated = { ...existing, ...patch };
        aiRunStore.set(id, updated);
        return Promise.resolve(updated);
      },
      delete: (id: string) => {
        aiRunStore.delete(id);
        return Promise.resolve();
      },
    },
    aiRunToolCalls: {
      create: (input: AiRunToolCallCreate) => {
        aiRunToolCallStore.set(input.id, input);
        return Promise.resolve(input);
      },
      getById: (id: string) =>
        Promise.resolve(aiRunToolCallStore.get(id) ?? null),
      listByRun: (
        input: Parameters<Database["aiRunToolCalls"]["listByRun"]>[0]
      ) => {
        const sort = input.sort ?? "desc";
        const limit = input.limit ?? 50;
        const aiRunToolCalls = Array.from(aiRunToolCallStore.values()).filter(
          (toolCall) => toolCall.aiRunId === input.aiRunId
        );
        const sorted = applyCursor(
          aiRunToolCalls.sort(compareByCreatedAt(sort)),
          input.cursor,
          sort
        );
        return Promise.resolve(sorted.slice(0, limit));
      },
      update: (id: string, patch: AiRunToolCallUpdate) => {
        const existing = aiRunToolCallStore.get(id);
        if (!existing) {
          return Promise.reject(new Error(`AI run tool call not found: ${id}`));
        }
        const updated = { ...existing, ...patch };
        aiRunToolCallStore.set(id, updated);
        return Promise.resolve(updated);
      },
      delete: (id: string) => {
        aiRunToolCallStore.delete(id);
        return Promise.resolve();
      },
    },
    threads: {
      create: (input: ThreadCreate) => {
        threadStore.set(input.id, input);
        return Promise.resolve(input);
      },
      getById: (id: string) => Promise.resolve(threadStore.get(id) ?? null),
      list: (input: Parameters<Database["threads"]["list"]>[0]) => {
        const sort = input.sort ?? "desc";
        const limit = input.limit ?? 50;
        const threads = Array.from(threadStore.values()).filter(
          (thread) => thread.botId === input.botId
        );
        const sorted = applyCursor(
          threads.sort(compareByCreatedAt(sort)),
          input.cursor,
          sort
        );
        return Promise.resolve(sorted.slice(0, limit));
      },
      update: (id: string, patch: ThreadUpdate) => {
        const existing = threadStore.get(id);
        if (!existing) {
          return Promise.reject(new Error(`Thread not found: ${id}`));
        }
        const updated = { ...existing, ...patch };
        threadStore.set(id, updated);
        return Promise.resolve(updated);
      },
      delete: (id: string) => {
        threadStore.delete(id);
        return Promise.resolve();
      },
    },
    messages: {
      create: (input: MessageCreate) => {
        messageStore.set(input.id, input);
        return Promise.resolve(input);
      },
      getById: (id: string) => Promise.resolve(messageStore.get(id) ?? null),
      listByThread: (
        input: Parameters<Database["messages"]["listByThread"]>[0]
      ) => {
        const sort = input.sort ?? "desc";
        const limit = input.limit ?? 50;
        const messages = Array.from(messageStore.values()).filter(
          (message) => message.threadId === input.threadId
        );
        const sorted = applyCursor(
          messages.sort(compareByCreatedAt(sort)),
          input.cursor,
          sort
        );
        return Promise.resolve(sorted.slice(0, limit));
      },
      update: (id: string, patch: MessageUpdate) => {
        const existing = messageStore.get(id);
        if (!existing) {
          return Promise.reject(new Error(`Message not found: ${id}`));
        }
        const updated = { ...existing, ...patch };
        messageStore.set(id, updated);
        return Promise.resolve(updated);
      },
      delete: (id: string) => {
        messageStore.delete(id);
        return Promise.resolve();
      },
    },
    transaction: <T>(fn: (database: Database) => Promise<T>) => fn(database),
  };

  return database;
};
