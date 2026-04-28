import type { Database } from "@goodchat/contracts/database/interface";
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../utils";

const connectionString = process.env.POSTGRES_TEST_URL;
const describePostgres = connectionString ? describe : describe.skip;

const withDatabase = async <T>(
  fn: (database: Database) => Promise<T>
): Promise<T> => {
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

describePostgres("postgres transactions", () => {
  it("rolls back when the transaction fails", async () => {
    await withDatabase(async (database) => {
      await expect(
        database.transaction(async (tx: Database) => {
          await tx.threads.create({
            id: "thread-1",
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
          });
          throw new Error("fail");
        })
      ).rejects.toThrow("fail");

      const threads = await database.threads.list({
        limit: 10,
        sort: "asc",
      });

      expect(threads.length).toBe(0);
    });
  });
});
