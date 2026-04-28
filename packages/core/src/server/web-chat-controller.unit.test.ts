import type { Bot } from "@goodchat/contracts/config/types";
import { createUIMessageStream } from "ai";
import { Result } from "better-result";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import type { ChatResponseService } from "../chat-response/interface";
import { NoopLoggerService } from "../logger/service";
import { webChatController } from "./web-chat-controller";

const bot: Pick<Bot, "id" | "name" | "platforms"> = {
  id: "web-bot",
  name: "Local Bot",
  platforms: ["web"],
};

const createResponseHandler = (chunks: string[]): ChatResponseService => ({
  handleMessage: async () =>
    Result.ok({
      action: "respond" as const,
      text: chunks.join(""),
      threadEntryId: "thread-1",
    }),
  handleMessageStream: async () =>
    Result.ok({
      action: "respond" as const,
      uiStream: createUIMessageStream({
        execute({ writer }) {
          writer.write({ type: "text-start", id: "greeting" });
          for (const chunk of chunks) {
            writer.write({ type: "text-delta", id: "greeting", delta: chunk });
          }
          writer.write({ type: "text-end", id: "greeting" });
        },
      }),
    }),
});

const createApp = (chunks: string[]) =>
  new Elysia().use(
    webChatController({
      botName: bot.name,
      logger: new NoopLoggerService(),
      platforms: bot.platforms,
      responseHandler: createResponseHandler(chunks),
    })
  );

describe("webChatController", () => {
  it("streams responses and sets the thread id header", async () => {
    const app = createApp(["Hello ", "world"]);

    const response = await app.handle(
      new Request("http://localhost/web/chat/stream", {
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

  it("returns 400 when no message text is in the request", async () => {
    const app = createApp(["Hello"]);

    const response = await app.handle(
      new Request("http://localhost/web/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "thread-1",
          trigger: "submit-message",
          messages: [],
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Message is required",
    });
  });

  it("returns text and threadId from sync endpoint", async () => {
    const app = createApp(["Hello ", "world"]);

    const response = await app.handle(
      new Request("http://localhost/web/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "thread-1", message: "Hi" }),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { text: string; threadId: string };
    expect(body.text).toBe("Hello world");
    expect(body.threadId).toBe("thread-1");
  });

  it("returns 429 and retry-after when sync request is denied", async () => {
    const app = new Elysia().use(
      webChatController({
        botName: bot.name,
        logger: new NoopLoggerService(),
        platforms: bot.platforms,
        responseHandler: {
          handleMessage: async () =>
            Result.ok({
              action: "deny" as const,
              reason: "rate_limited" as const,
              retryAfterMs: 25_000,
              userMessage: "Rate limit reached",
            }),
          handleMessageStream: async () =>
            Result.ok({
              action: "respond" as const,
              uiStream: createUIMessageStream({
                execute: () => undefined,
              }),
            }),
        },
      })
    );

    const response = await app.handle(
      new Request("http://localhost/web/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "thread-1", message: "Hi" }),
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("25");
    await expect(response.json()).resolves.toEqual({
      message: "Rate limit reached",
      reason: "rate_limited",
    });
  });
});
