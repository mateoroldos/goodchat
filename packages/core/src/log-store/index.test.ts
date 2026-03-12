import { describe, expect, it } from "vitest";
import { InMemoryLogStoreService } from "./index";
import type { LogEntry } from "./types";

const createLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  botName: "Echo",
  id: "log-1",
  platform: "local",
  responseText: "Echo: Hello",
  text: "Hello",
  threadId: "thread-1",
  timestamp: new Date().toISOString(),
  userId: "user-1",
  ...overrides,
});

describe("InMemoryLogStoreService", () => {
  it("appends logs and returns the latest entries first", () => {
    const service = new InMemoryLogStoreService();
    service.appendLog(createLogEntry({ id: "log-1", text: "First" }));
    service.appendLog(createLogEntry({ id: "log-2", text: "Second" }));

    const result = service.listLogs(2);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.map((entry) => entry.id)).toEqual(["log-2", "log-1"]);
  });

  it("caps the list size by the provided limit", () => {
    const service = new InMemoryLogStoreService();
    service.appendLog(createLogEntry({ id: "log-1", text: "First" }));
    service.appendLog(createLogEntry({ id: "log-2", text: "Second" }));

    const result = service.listLogs(1);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe("log-2");
  });

  it("returns an error for invalid limits", () => {
    const service = new InMemoryLogStoreService();

    const result = service.listLogs(-1);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("LOG_LIMIT_INVALID");
  });
});
