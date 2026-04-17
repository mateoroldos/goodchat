import {
  createUIMessageStream,
  type generateText,
  readUIMessageStream,
  type streamText,
} from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvlogAiTelemetryService } from "../ai-telemetry/service";
import { NoopLoggerService } from "../logger/service";
import { DefaultAiResponseService } from "./index";

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

const createLogger = () => ({
  emit: vi.fn(() => null),
  error: vi.fn(),
  getContext: vi.fn(() => ({})),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
});

const makeService = () =>
  new DefaultAiResponseService({
    generateText: mockGenerateText as unknown as typeof generateText,
    streamText: mockStreamText as unknown as typeof streamText,
  });

describe("DefaultAiResponseService", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    mockGenerateText.mockReset();
    mockStreamText.mockReset();
  });

  it("generates text responses", async () => {
    mockGenerateText.mockResolvedValue({ text: "AI: Hello" });

    const result = await makeService().generate({
      logger: createLogger(),
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      systemPrompt: "Be friendly\n\nBot name: Echo",
      userMessage: "Hello",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.text).toBe("AI: Hello");
    expect(result.value.telemetry.mode).toBe("sync");
  });

  it("captures tool calls from step telemetry", async () => {
    mockGenerateText.mockResolvedValue({
      finishReason: "stop",
      steps: [
        {
          toolCalls: [
            {
              input: { state: "open" },
              toolCallId: "call-1",
              toolName: "list_issues",
            },
            {
              input: { state: "open" },
              toolCallId: "call-2",
              toolName: "list_issues",
            },
          ],
          toolResults: [
            { output: { count: 10 }, toolCallId: "call-1" },
            { output: { count: 5 }, toolCallId: "call-2" },
          ],
        },
      ],
      text: "AI: Done",
      totalUsage: { inputTokens: 100, outputTokens: 12, totalTokens: 112 },
    });

    const result = await makeService().generate({
      logger: createLogger(),
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      systemPrompt: "Be friendly\n\nBot name: Echo",
      userMessage: "List issues",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.telemetry.toolCalls).toHaveLength(2);
    expect(result.value.telemetry.toolCalls[0]?.toolName).toBe("list_issues");
    expect(result.value.telemetry.totalTokens).toBe(112);
  });

  it("streams text responses", async () => {
    mockStreamText.mockReturnValue({
      toUIMessageStream: () =>
        createUIMessageStream({
          execute({ writer }) {
            writer.write({ type: "text-start", id: "response" });
            writer.write({ type: "text-delta", id: "response", delta: "AI: " });
            writer.write({
              type: "text-delta",
              id: "response",
              delta: "Hello",
            });
            writer.write({ type: "text-end", id: "response" });
          },
        }),
    });

    const result = await makeService().stream({
      logger: createLogger(),
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      systemPrompt: "Be friendly\n\nBot name: Echo",
      userMessage: "Hello",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    let responseText = "";
    for await (const uiMessage of readUIMessageStream({
      stream: result.value.uiStream,
    })) {
      if (uiMessage.role !== "assistant") {
        continue;
      }

      responseText = uiMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    }

    expect(responseText).toBe("AI: Hello");
  });

  it("returns an error when model is missing", async () => {
    const result = await makeService().generate({
      logger: createLogger(),
      systemPrompt: "Be friendly",
      userMessage: "Hello",
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected generate to fail without model");
    }

    expect(result.error.message).toContain("No model is configured");
  });

  it("uses ai middleware without experimental telemetry", async () => {
    mockGenerateText.mockResolvedValue({ text: "AI: Hello" });
    const service = new DefaultAiResponseService(
      {
        generateText: mockGenerateText as unknown as typeof generateText,
        streamText: mockStreamText as unknown as typeof streamText,
      },
      new EvlogAiTelemetryService(new NoopLoggerService())
    );

    const result = await service.generate({
      logger: createLogger(),
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      systemPrompt: "Be friendly\n\nBot name: Echo",
      userMessage: "Hello",
    });

    expect(result.isOk()).toBe(true);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText.mock.calls[0]?.[0]?.experimental_telemetry).toBe(
      undefined
    );
  });
});
