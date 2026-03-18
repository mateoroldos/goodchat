import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BotConfig } from "../config/models";
import type { IncomingMessage } from "./models";
import { DefaultResponseGeneratorService } from "./response-generator.service";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

const mockedGenerateText = generateText as unknown as ReturnType<typeof vi.fn>;

describe("DefaultResponseGeneratorService", () => {
  beforeEach(() => {
    mockedGenerateText.mockReset();
  });

  it("echoes back valid messages", async () => {
    const service = new DefaultResponseGeneratorService();
    const botConfig: BotConfig = {
      id: "echo",
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

    mockedGenerateText.mockResolvedValue(mockResult);

    const result = await service.generateResponse({
      botConfig,
      message,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toEqual({ text: "AI: Hello" });
  });

  it("returns validation errors for invalid messages", async () => {
    const service = new DefaultResponseGeneratorService();
    const botConfig: BotConfig = {
      id: "echo",
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

    const result = await service.generateResponse({
      botConfig,
      message: invalidMessage,
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("BOT_INPUT_INVALID");
    expect(result.error.details?.length).toBeGreaterThan(0);
    expect(generateText).not.toHaveBeenCalled();
  });
});
