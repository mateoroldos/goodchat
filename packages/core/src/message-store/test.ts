import { describe, expect, it } from "vitest";
import { InMemoryMessageStoreService } from "./index";
import type { MessageEntry } from "./models";

const clock = () => new Date("2024-01-01T00:00:00.000Z");

const createMessageEntry = (
  overrides: Partial<MessageEntry> = {}
): MessageEntry => ({
  adapterName: "local",
  botId: "local-echo",
  botName: "Echo",
  id: "thread-1",
  platform: "local",
  responseText: "Echo: Hello",
  text: "Hello",
  threadId: "thread-1",
  timestamp: clock().toISOString(),
  userId: "user-1",
  ...overrides,
});

describe("InMemoryMessageStoreService", () => {
  it("appends threads and returns the latest entries first", () => {
    const service = new InMemoryMessageStoreService();
    service.appendThread(createMessageEntry({ id: "thread-1", text: "First" }));
    service.appendThread(
      createMessageEntry({ id: "thread-2", text: "Second" })
    );

    const result = service.listThreads(2);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.map((entry) => entry.id)).toEqual([
      "thread-2",
      "thread-1",
    ]);
  });

  it("caps the list size by the provided limit", () => {
    const service = new InMemoryMessageStoreService();
    service.appendThread(createMessageEntry({ id: "thread-1", text: "First" }));
    service.appendThread(
      createMessageEntry({ id: "thread-2", text: "Second" })
    );

    const result = service.listThreads(1);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe("thread-2");
  });

  it("returns an error for invalid limits", () => {
    const service = new InMemoryMessageStoreService();

    const result = service.listThreads(-1);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("THREAD_LIMIT_INVALID");
  });
});
