import type { Database } from "@goodchat/contracts/database/interface";
import { describe, expect, it } from "vitest";
import { createRateLimitRepository } from "./index";

const createDatabaseStub = (): Database => {
  return {
    aiRuns: {
      create(input) {
        return Promise.resolve(input as never);
      },
      delete() {
        return Promise.resolve();
      },
      getById() {
        return Promise.resolve(null);
      },
      listByThread(input) {
        if (input.cursor) {
          return Promise.resolve([]);
        }

        if (input.threadId === "thread-1") {
          return Promise.resolve([
            {
              assistantMessageId: "m-1",
              createdAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
              hadError: false,
              id: "run-1",
              inputTokens: 10,
              mode: "sync",
              modelId: "gpt-4.1-mini",
              outputTokens: 15,
              provider: "openai",
              providerMetadata: undefined,
              threadId: "thread-1",
              totalTokens: 25,
              usage: undefined,
              userId: "user-1",
            },
          ]);
        }

        return Promise.resolve([]);
      },
      update(_id, patch) {
        return Promise.resolve(patch as never);
      },
    },
    aiRunToolCalls: {
      create(input) {
        return Promise.resolve(input as never);
      },
      delete() {
        return Promise.resolve();
      },
      getById() {
        return Promise.resolve(null);
      },
      listByRun() {
        return Promise.resolve([]);
      },
      update(_id, patch) {
        return Promise.resolve(patch as never);
      },
    },
    analytics: {
      weeklyStats() {
        return Promise.resolve({ threadsByDay: [], tokensByDay: [] });
      },
    },
    connection: {
      delete() {
        return {
          where() {
            return Promise.resolve();
          },
        };
      },
      insert() {
        return {
          values() {
            return Promise.resolve();
          },
        };
      },
      select() {
        return {
          from() {
            return {
              where() {
                return Promise.resolve([{ tokens: 25 }]);
              },
            };
          },
        };
      },
      update() {
        return {
          set() {
            return {
              where() {
                return Promise.resolve();
              },
            };
          },
        };
      },
    },
    dialect: "sqlite",
    messages: {
      create(input) {
        return Promise.resolve(input as never);
      },
      delete() {
        return Promise.resolve();
      },
      getById() {
        return Promise.resolve(null);
      },
      listByThread() {
        return Promise.resolve([]);
      },
      update(_id, patch) {
        return Promise.resolve(patch as never);
      },
    },
    threads: {
      create(input) {
        return Promise.resolve(input as never);
      },
      delete() {
        return Promise.resolve();
      },
      getById() {
        return Promise.resolve(null);
      },
      list(input) {
        if (input.cursor) {
          return Promise.resolve([]);
        }

        return Promise.resolve([
          {
            adapterName: "web",
            botName: "Bot",
            createdAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
            id: "thread-1",
            lastActivityAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
            platform: "web",
            responseText: "hello",
            text: "hello",
            threadId: "thread-1",
            updatedAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
            userId: "user-1",
          },
        ]);
      },
      update(_id, patch) {
        return Promise.resolve(patch as never);
      },
    },
    transaction(fn) {
      return fn(this);
    },
  };
};

describe("createRateLimitRepository", () => {
  it("reads token usage from aggregate buckets when database is provided", async () => {
    const repository = createRateLimitRepository(createDatabaseStub());

    const tokens = await repository.getTokenUsage({
      since: new Date("2026-01-01T00:00:00.000Z"),
      userId: "user-1",
    });

    expect(tokens).toBe(25);
  });
});
