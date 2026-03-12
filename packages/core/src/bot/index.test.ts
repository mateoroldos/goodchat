import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultBotService } from "./index";
import type { BotConfig, IncomingMessage } from "./types";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("DefaultBotService", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("echoes back valid messages", async () => {
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

    const mockResult = {
      text: "AI: Hello",
    } as unknown as Awaited<ReturnType<typeof generateText>>;

    vi.mocked(generateText).mockResolvedValue(mockResult);

    const result = await service.sendMessage(message, botConfig);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toEqual({ text: "AI: Hello" });
  });

  it("returns validation errors for invalid messages", async () => {
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

    const result = await service.sendMessage(invalidMessage, botConfig);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("BOT_INPUT_INVALID");
    expect(result.error.details?.length).toBeGreaterThan(0);
    expect(generateText).not.toHaveBeenCalled();
  });
});
