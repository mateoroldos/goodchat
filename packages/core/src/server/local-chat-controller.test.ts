import type { BotConfig } from "@goodbot/contracts/config/types";
import { createUIMessageStream } from "ai";
import { Result } from "better-result";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import type { AiResponseService } from "../ai-response/interface";
import type { AiCallParams } from "../ai-response/models";
import { DefaultChatResponseService } from "../chat-response";
import type { GoodbotExtensions } from "../extensions/models";
import { InMemoryMessageStoreService } from "../message-store";
import { localChatController } from "./local-chat-controller";

const emptyExtensions: GoodbotExtensions = {
  afterMessageHooks: [],
  beforeMessageHooks: [],
  mcp: [],
  systemPrompt: "",
  tools: {},
};

const createResponseHandler = (chunks: string[]) => {
  const aiResponse: AiResponseService = {
    generate: (_params: AiCallParams) =>
      Promise.resolve(Result.ok({ text: chunks.join("") })),
    stream: (_params: AiCallParams) =>
      Promise.resolve(
        Result.ok({
          uiStream: createUIMessageStream({
            execute({ writer }) {
              writer.write({ type: "text-start", id: "greeting" });
              for (const chunk of chunks) {
                writer.write({
                  type: "text-delta",
                  id: "greeting",
                  delta: chunk,
                });
              }
              writer.write({ type: "text-end", id: "greeting" });
            },
          }),
        })
      ),
  };

  const botConfig: BotConfig = {
    id: "local-bot",
    name: "Local Bot",
    prompt: "Be helpful",
    platforms: ["local"],
  };

  return new DefaultChatResponseService({
    aiResponse,
    extensions: emptyExtensions,
    messageStore: new InMemoryMessageStoreService(),
    botConfig,
  });
};

const createApp = (chunks: string[]) => {
  const botConfig: BotConfig = {
    id: "local-bot",
    name: "Local Bot",
    prompt: "Be helpful",
    platforms: ["local"],
  };
  const responseHandler = createResponseHandler(chunks);

  return new Elysia().use(
    localChatController({
      botConfig,
      responseHandler,
    })
  );
};

describe("localChatController", () => {
  it("streams responses and sets the thread id header", async () => {
    const app = createApp(["Hello ", "world"]);

    const response = await app.handle(
      new Request("http://localhost/local/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "thread-1",
          trigger: "submit-message",
          messages: [
            {
              id: "msg-1",
              role: "user",
              parts: [{ type: "text", text: "Hi" }],
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const threadId = response.headers.get("x-thread-id");
    expect(threadId).toBeTruthy();
    expect(threadId).toBe("thread-1");
    await expect(response.text()).resolves.toContain("text-delta");
  });
});
