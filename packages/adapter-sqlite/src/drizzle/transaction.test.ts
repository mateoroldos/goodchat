import type { Database } from "@goodchat/contracts/database/interface";
import { describe, expect, it } from "vitest";
import { sqlite } from "../index";

describe("sqlite transactions", () => {
  it("rolls back when the transaction fails", async () => {
    const database = sqlite({ path: ":memory:" });

    await expect(
      database.transaction(async (tx: Database) => {
        await tx.threads.create({
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
        });
        throw new Error("fail");
      })
    ).rejects.toThrow("fail");

    const threads = await database.threads.list({
      botId: "bot-1",
      limit: 10,
      sort: "asc",
    });

    expect(threads.length).toBe(0);
  });
});
