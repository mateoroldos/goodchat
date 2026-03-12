import { describe, expect, it } from "vitest";
import { DefaultBotService } from "./index";
import type { BotConfig, IncomingMessage } from "./types";

describe("DefaultBotService", () => {
  it("echoes back valid messages", () => {
    const service = new DefaultBotService();
    const botConfig: BotConfig = {
      name: "Echo",
      prompt: "Be friendly",
      platforms: ["local"],
    };
    const message: IncomingMessage = {
      botName: "Echo",
      platform: "local",
      text: "Hello",
      threadId: "thread-1",
      userId: "user-1",
    };

    const result = service.sendMessage(message, botConfig);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toEqual({ text: "Echo: Hello" });
  });

  it("returns validation errors for invalid messages", () => {
    const service = new DefaultBotService();
    const botConfig: BotConfig = {
      name: "Echo",
      prompt: "Be friendly",
      platforms: ["local"],
    };

    const invalidMessage = {
      botName: "Echo",
      platform: "local",
      text: "",
      threadId: "thread-1",
      userId: "user-1",
    } as IncomingMessage;

    const result = service.sendMessage(invalidMessage, botConfig);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("BOT_INPUT_INVALID");
    expect(result.error.details?.length).toBeGreaterThan(0);
  });
});
