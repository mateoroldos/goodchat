import {
  createUIMessageStream,
  type generateText,
  readUIMessageStream,
  type streamText,
} from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultAiResponseService } from "./index";

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

const makeService = () =>
  new DefaultAiResponseService({
    generateText: mockGenerateText as unknown as typeof generateText,
    streamText: mockStreamText as unknown as typeof streamText,
  });

describe("DefaultAiResponseService", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockStreamText.mockReset();
  });

  it("generates text responses", async () => {
    mockGenerateText.mockResolvedValue({ text: "AI: Hello" });

    const result = await makeService().generate({
      systemPrompt: "Be friendly\n\nBot name: Echo",
      userMessage: "Hello",
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value).toEqual({ text: "AI: Hello" });
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
});
