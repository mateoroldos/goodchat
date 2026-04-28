import { describe, expect, it } from "bun:test";
import type {
  MessageCreate,
  MessageUpdate,
} from "@goodchat/contracts/database/message";
import type {
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import { createTestDatabase } from "../utils";

const buildThread = (overrides: Partial<ThreadCreate> = {}): ThreadCreate => {
  return {
    id: "thread-1",
    botName: "Support Bot",
    platform: "slack",
    adapterName: "slack",
    threadId: "slack-thread-1",
    userId: "user-1",
    text: "Hello",
    responseText: "Hi",
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    lastActivityAt: "2026-03-31T00:00:00.000Z",
    ...overrides,
  };
};

const buildMessage = (
  overrides: Partial<MessageCreate> = {}
): MessageCreate => {
  return {
    id: "message-1",
    threadId: "thread-1",
    role: "user",
    text: "Hello",
    createdAt: "2026-03-31T00:00:00.000Z",
    metadata: { locale: "en-US" },
    userId: "user-1",
    adapterName: "slack",
    ...overrides,
  };
};

describe("sqlite repositories", () => {
  it("creates and reads threads", async () => {
    const database = createTestDatabase();
    const input = buildThread();

    await database.threads.create(input);
    const thread = await database.threads.getById(input.id);

    expect(thread?.id).toBe(input.id);
  });

  it("updates thread fields without losing data", async () => {
    const database = createTestDatabase();
    const input = buildThread();
    const patch: ThreadUpdate = {
      text: "Updated",
      responseText: "Updated response",
      updatedAt: "2026-03-31T00:00:01.000Z",
      lastActivityAt: "2026-03-31T00:00:01.000Z",
    };

    await database.threads.create(input);
    const updated = await database.threads.update(input.id, patch);

    expect(updated.text).toBe(patch.text);
    expect(updated.responseText).toBe(patch.responseText);
  });

  it("lists threads with stable ordering", async () => {
    const database = createTestDatabase();
    await database.threads.create(buildThread({ id: "thread-1" }));
    await database.threads.create(
      buildThread({
        id: "thread-2",
        createdAt: "2026-03-31T00:00:01.000Z",
        updatedAt: "2026-03-31T00:00:01.000Z",
        lastActivityAt: "2026-03-31T00:00:01.000Z",
      })
    );

    const threads = await database.threads.list({
      limit: 10,
      sort: "asc",
    });

    expect(threads[0]?.id).toBe("thread-1");
  });

  it("creates and reads messages", async () => {
    const database = createTestDatabase();
    const input = buildMessage();

    await database.messages.create(input);
    const message = await database.messages.getById(input.id);

    expect(message?.id).toBe(input.id);
    expect(message?.metadata).toEqual(input.metadata);
  });

  it("updates message content", async () => {
    const database = createTestDatabase();
    const input = buildMessage();
    const patch: MessageUpdate = {
      text: "Updated",
      metadata: { locale: "fr-FR" },
    };

    await database.messages.create(input);
    const updated = await database.messages.update(input.id, patch);

    expect(updated.text).toBe(patch.text);
    expect(updated.metadata).toEqual(patch.metadata);
  });

  it("stores ai runs with tool calls", async () => {
    const database = createTestDatabase();
    const runId = "run-1";
    const toolCallId = "tool-call-1";

    await database.aiRuns.create({
      assistantMessageId: "message-assistant-1",
      createdAt: "2026-03-31T00:00:00.000Z",
      finishReason: "stop",
      hadError: false,
      id: runId,
      inputTokens: 12,
      mode: "sync",
      modelId: "gpt-4.1-mini",
      outputTokens: 34,
      provider: "openai",
      threadId: "thread-1",
      totalTokens: 46,
      userId: "user-1",
    });

    await database.aiRunToolCalls.create({
      aiRunId: runId,
      createdAt: "2026-03-31T00:00:01.000Z",
      id: toolCallId,
      input: { location: "Berlin" },
      output: { temperature: 20 },
      status: "success",
      toolCallId: "call_1",
      toolName: "weather",
    });

    const runs = await database.aiRuns.listByThread({
      threadId: "thread-1",
      limit: 10,
      sort: "desc",
    });
    const toolCalls = await database.aiRunToolCalls.listByRun({
      aiRunId: runId,
      sort: "asc",
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]?.totalTokens).toBe(46);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]?.toolName).toBe("weather");
  });
});
