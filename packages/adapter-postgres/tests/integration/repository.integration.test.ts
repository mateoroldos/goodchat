import type {
  MessageCreate,
  MessageUpdate,
} from "@goodchat/contracts/database/message";
import type {
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../utils";

const connectionString = process.env.POSTGRES_TEST_URL;
const describePostgres = connectionString ? describe : describe.skip;

const buildThread = (overrides: Partial<ThreadCreate> = {}): ThreadCreate => {
  return {
    id: "thread-1",
    botId: "bot-1",
    botName: "Support Bot",
    platform: "slack",
    adapterName: "slack",
    threadId: "slack-thread-1",
    userId: "user-1",
    text: "Hello",
    responseText: "Hi",
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    lastActivityAt: "2026-03-31T00:00:00.000Z",
    ...overrides,
  };
};

const buildMessage = (
  overrides: Partial<MessageCreate> = {}
): MessageCreate => {
  return {
    id: "message-1",
    threadId: "thread-1",
    role: "user",
    text: "Hello",
    createdAt: "2026-03-31T00:00:00.000Z",
    metadata: { locale: "en-US" },
    userId: "user-1",
    adapterName: "slack",
    ...overrides,
  };
};

const withDatabase = async <T>(
  fn: (
    database: Awaited<ReturnType<typeof createTestDatabase>>["database"]
  ) => Promise<T> | T
) => {
  if (!connectionString) {
    throw new Error("POSTGRES_TEST_URL is required.");
  }
  const { database, cleanup } = await createTestDatabase(connectionString);
  try {
    return await fn(database);
  } finally {
    await cleanup();
  }
};

describePostgres("postgres repositories", () => {
  it("creates and reads threads", async () => {
    await withDatabase(async (database) => {
      const input = buildThread();

      await database.threads.create(input);
      const thread = await database.threads.getById(input.id);

      expect(thread?.id).toBe(input.id);
    });
  });

  it("updates thread fields without losing data", async () => {
    await withDatabase(async (database) => {
      const input = buildThread();
      const patch: ThreadUpdate = {
        text: "Updated",
        responseText: "Updated response",
        updatedAt: "2026-03-31T00:00:01.000Z",
        lastActivityAt: "2026-03-31T00:00:01.000Z",
      };

      await database.threads.create(input);
      const updated = await database.threads.update(input.id, patch);

      expect(updated.text).toBe(patch.text);
      expect(updated.responseText).toBe(patch.responseText);
    });
  });

  it("lists threads with stable ordering", async () => {
    await withDatabase(async (database) => {
      await database.threads.create(buildThread({ id: "thread-1" }));
      await database.threads.create(
        buildThread({
          id: "thread-2",
          createdAt: "2026-03-31T00:00:01.000Z",
          updatedAt: "2026-03-31T00:00:01.000Z",
          lastActivityAt: "2026-03-31T00:00:01.000Z",
        })
      );

      const threads = await database.threads.list({
        botId: "bot-1",
        limit: 10,
        sort: "asc",
      });

      expect(threads[0]?.id).toBe("thread-1");
    });
  });

  it("creates and reads messages", async () => {
    await withDatabase(async (database) => {
      const input = buildMessage();

      await database.messages.create(input);
      const message = await database.messages.getById(input.id);

      expect(message?.id).toBe(input.id);
      expect(message?.metadata).toEqual(input.metadata);
    });
  });

  it("updates message content", async () => {
    await withDatabase(async (database) => {
      const input = buildMessage();
      const patch: MessageUpdate = {
        text: "Updated",
        metadata: { locale: "fr-FR" },
      };

      await database.messages.create(input);
      const updated = await database.messages.update(input.id, patch);

      expect(updated.text).toBe(patch.text);
      expect(updated.metadata).toEqual(patch.metadata);
    });
  });
});
