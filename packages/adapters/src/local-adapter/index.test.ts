import { describe, expect, it } from "vitest";
import { DefaultLocalAdapterService } from "./index";

describe("DefaultLocalAdapterService", () => {
  it("parses valid webhook payloads", () => {
    const service = new DefaultLocalAdapterService();

    const result = service.parseWebhook({
      botName: "Echo",
      text: "Hello",
      userId: "user-1",
      threadId: "thread-1",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toEqual({
      botName: "Echo",
      text: "Hello",
      userId: "user-1",
      threadId: "thread-1",
      platform: "local",
    });
  });

  it("returns a structured error for invalid payloads", () => {
    const service = new DefaultLocalAdapterService();

    const result = service.parseWebhook({
      botName: "",
      text: "",
      userId: "",
      threadId: "",
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("INVALID_PAYLOAD");
    expect(result.error.details?.length).toBeGreaterThan(0);
  });
});
