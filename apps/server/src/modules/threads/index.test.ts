import type { MessageEntry } from "@goodchat/core/message-store/models";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test/create-test-app";

const createThreadEntry = (
  overrides: Partial<MessageEntry> = {}
): MessageEntry => ({
  adapterName: "local",
  botId: "bot-1",
  botName: "Echo",
  id: "thread-1",
  platform: "local",
  responseText: "Echo: Hello",
  text: "Hello",
  threadId: "thread-1",
  timestamp: new Date().toISOString(),
  userId: "user-1",
  ...overrides,
});

describe("GET /threads", () => {
  it("returns threads using the default limit", async () => {
    const { app, messageStore } = await createTestApp();
    messageStore.appendThread(
      createThreadEntry({ id: "thread-1", text: "First" })
    );
    messageStore.appendThread(
      createThreadEntry({ id: "thread-2", text: "Second" })
    );

    const response = await app.handle(new Request("http://localhost/threads"));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as MessageEntry[];

    expect(payload.map((entry) => entry.id)).toEqual(["thread-2", "thread-1"]);
  });

  it("respects the requested limit", async () => {
    const { app, messageStore } = await createTestApp();
    messageStore.appendThread(
      createThreadEntry({ id: "thread-1", text: "First" })
    );
    messageStore.appendThread(
      createThreadEntry({ id: "thread-2", text: "Second" })
    );

    const response = await app.handle(
      new Request("http://localhost/threads?limit=1")
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as MessageEntry[];
    expect(payload).toHaveLength(1);
    expect(payload[0]?.id).toBe("thread-2");
  });

  it("rejects invalid limits with a 400", async () => {
    const { app } = await createTestApp();

    const response = await app.handle(
      new Request("http://localhost/threads?limit=-1")
    );

    expect(response.status).toBe(422);
  });
});
