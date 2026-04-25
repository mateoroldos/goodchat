import type { Bot } from "@goodchat/contracts/config/types";
import type { Database } from "@goodchat/contracts/database/interface";
import type { Logger } from "@goodchat/contracts/plugins/types";
import { createUIMessageStream } from "ai";
import { Result } from "better-result";
import { describe, expect, it, vi } from "vitest";
import { AiResponseGenerationError } from "../ai-response/errors";
import type { AiResponseService } from "../ai-response/interface";
import type { AiRunTelemetry } from "../ai-response/models";
import type { LoggerService } from "../logger/interface";
import { createDatabaseStub } from "../test-utils/database-stub";
import type { MessageContext } from "../types";
import { DefaultChatResponseService } from "./index";

const createLogger = (context: Record<string, unknown> = {}): Logger => ({
  emit: vi.fn(() => null),
  error: vi.fn(),
  getContext: vi.fn(() => context),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
});

const createTelemetry = (mode: "stream" | "sync"): AiRunTelemetry => ({
  createdAt: new Date().toISOString(),
  hadError: false,
  mode,
  modelId: "gpt-4.1-mini",
  provider: "openai",
  toolCalls: [],
});

const createContext = (text = "Hello"): MessageContext => ({
  adapterName: "web",
  botId: "bot-id",
  botName: "Echo",
  platform: "web",
  text,
  threadId: "thread-1",
  userId: "user-1",
});

const createBot = ({
  database,
  hooks,
}: {
  database: Database;
  hooks?: Bot["hooks"];
}): Bot => ({
  auth: { enabled: false, webChatPublic: false, mode: "password" },
  corsOrigin: undefined,
  database,
  hooks: hooks ?? {
    afterMessage: [],
    beforeMessage: [],
  },
  id: "bot-id",
  isServerless: false,
  logging: { enabled: true },
  mcp: [],
  model: { modelId: "gpt-4.1-mini", provider: "openai" },
  name: "Echo",
  platforms: ["web"],
  plugins: [],
  prompt: "Be helpful",
  state: { adapter: "database" },
  tools: {},
  dashboard: true,
});

const createLoggerService = (
  requestLogger = createLogger(),
  backgroundLogger = createLogger()
): LoggerService => ({
  event: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  request: vi.fn(() => requestLogger),
  wide: vi.fn(() => backgroundLogger),
});

const createStreamAiResponse = (
  telemetry: AiRunTelemetry = createTelemetry("stream")
): AiResponseService => ({
  generate: vi.fn(),
  stream: vi.fn(async () =>
    Result.ok({
      telemetry: Promise.resolve(telemetry),
      uiStream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: "text-start", id: "response" });
          writer.write({
            type: "text-delta",
            delta: "Hello",
            id: "response",
          });
          writer.write({ type: "text-end", id: "response" });
        },
      }),
    })
  ),
});

const createService = ({
  aiResponse,
  logger,
  database,
  bot,
}: {
  aiResponse: AiResponseService;
  database?: Database;
  bot?: Bot;
  logger: LoggerService;
}) => {
  const db = database ?? createDatabaseStub();
  return new DefaultChatResponseService({
    aiResponse,
    bot: bot ?? createBot({ database: db }),
    logger,
  });
};

describe("DefaultChatResponseService", () => {
  it("returns input validation error when message text is empty", async () => {
    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(),
    };
    const logger = createLoggerService();

    const service = createService({ aiResponse, logger });
    const result = await service.handleMessage(createContext("   "));

    expect(result.isErr()).toBe(true);
    expect(aiResponse.generate).not.toHaveBeenCalled();
    expect(logger.request).not.toHaveBeenCalled();
  });

  it("maps ai generation failures to chat response generation errors", async () => {
    const aiError = new AiResponseGenerationError("upstream failed", ["x"]);
    const requestLogger = createLogger({ requestId: "req-1" });
    const aiResponse: AiResponseService = {
      generate: vi.fn(async () => Result.err(aiError)),
      stream: vi.fn(),
    };
    const logger = createLoggerService(requestLogger);

    const service = createService({ aiResponse, logger });
    const result = await service.handleMessage(createContext());

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected handleMessage to return an error");
    }
    expect(result.error.code).toBe("CHAT_RESPONSE_GENERATION_FAILED");
    expect(result.error.message).toBe("upstream failed");
    expect(requestLogger.error).toHaveBeenCalledTimes(1);
  });

  it("returns a hook error result when beforeMessage hook throws", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const beforeHook = vi.fn(() => {
      throw new Error("before hook failed");
    });
    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(),
    };
    const logger = createLoggerService(requestLogger);

    const service = createService({
      aiResponse,
      bot: createBot({
        database: createDatabaseStub(),
        hooks: {
          afterMessage: [],
          beforeMessage: [beforeHook],
        },
      }),
      logger,
    });

    const result = await service.handleMessage(createContext());

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected handleMessage to return an error");
    }
    expect(result.error.code).toBe("CHAT_RESPONSE_HOOK_FAILED");
    expect(beforeHook).toHaveBeenCalledTimes(1);
    expect(aiResponse.generate).not.toHaveBeenCalled();
  });

  it("continues sync response when afterMessage hook throws", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const afterHook = vi.fn(() => {
      throw new Error("after hook failed");
    });
    const aiResponse: AiResponseService = {
      generate: vi.fn(async () =>
        Result.ok({
          telemetry: createTelemetry("sync"),
          text: "AI: Hello",
        })
      ),
      stream: vi.fn(),
    };
    const logger = createLoggerService(requestLogger);

    const service = createService({
      aiResponse,
      bot: createBot({
        database: createDatabaseStub(),
        hooks: {
          afterMessage: [afterHook],
          beforeMessage: [],
        },
      }),
      logger,
    });

    const result = await service.handleMessage(createContext());

    expect(result.isOk()).toBe(true);
    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(requestLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("uses background logger for stream persistence failures", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const backgroundLogger = createLogger();
    const db = createDatabaseStub();
    db.transaction = async () => Promise.reject(new Error("db down"));

    const aiResponse = createStreamAiResponse();
    const logger = createLoggerService(requestLogger, backgroundLogger);

    const service = createService({
      aiResponse,
      database: db,
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await vi.waitFor(() => {
      expect(backgroundLogger.emit).toHaveBeenCalledTimes(1);
    });
    expect(backgroundLogger.error).toHaveBeenCalledTimes(1);
    expect(backgroundLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "db down" }),
      expect.objectContaining({
        error: expect.objectContaining({
          code: "CHAT_RESPONSE_STREAM_PERSISTENCE_FAILED",
          stage: "stream-post-process",
        }),
      })
    );
    expect(requestLogger.error).not.toHaveBeenCalled();
    expect(logger.wide).toHaveBeenCalledWith({
      mode: "stream",
      operation: "chat-response-post-process",
      parentRequestId: "req-1",
      thread: { id: "thread-1" },
      user: { id: "user-1" },
    });
  });

  it("runs stream after hooks with the background logger context", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const backgroundLogger = createLogger();
    const afterHook = vi.fn(async () => undefined);

    const aiResponse = createStreamAiResponse();
    const db = createDatabaseStub();
    const logger = createLoggerService(requestLogger, backgroundLogger);

    const service = createService({
      aiResponse,
      bot: createBot({
        database: db,
        hooks: {
          afterMessage: [afterHook],
          beforeMessage: [],
        },
      }),
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await vi.waitFor(() => {
      expect(afterHook).toHaveBeenCalledTimes(1);
    });
    expect(backgroundLogger.emit).toHaveBeenCalledTimes(1);
    expect(afterHook).toHaveBeenCalledWith(
      expect.objectContaining({ log: backgroundLogger }),
      expect.objectContaining({ text: "Hello" })
    );
  });

  it("sanitizes non-json telemetry before persisting ai run data", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const backgroundLogger = createLogger();
    const db = createDatabaseStub();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const telemetry: AiRunTelemetry = {
      ...createTelemetry("stream"),
      providerMetadata: circular,
      toolCalls: [
        {
          createdAt: new Date().toISOString(),
          error: circular,
          input: { count: BigInt(4) },
          output: { ok: true },
          status: "success",
          toolName: "list_issues",
        },
      ],
      usage: { count: BigInt(2), ok: true },
    };

    const aiResponse = createStreamAiResponse(telemetry);

    const logger = createLoggerService(requestLogger, backgroundLogger);

    const service = createService({
      aiResponse,
      database: db,
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await vi.waitFor(() => {
      expect(backgroundLogger.emit).toHaveBeenCalledTimes(1);
    });
    expect(backgroundLogger.error).not.toHaveBeenCalled();

    const [aiRunInsert] = await db.aiRuns.listByThread({
      threadId: createContext().threadId,
    });
    expect(aiRunInsert).toBeDefined();
    if (!aiRunInsert) {
      throw new Error("Expected AI run to be persisted");
    }
    expect(aiRunInsert.providerMetadata).toBeUndefined();
    expect(aiRunInsert.usage).toEqual({ count: "2", ok: true });

    const [toolCallInsert] = await db.aiRunToolCalls.listByRun({
      aiRunId: aiRunInsert.id,
    });
    expect(toolCallInsert).toBeDefined();
    if (!toolCallInsert) {
      throw new Error("Expected AI run tool call to be persisted");
    }
    expect(toolCallInsert.error).toBeUndefined();
    expect(toolCallInsert.input).toEqual({ count: "4" });
    expect(toolCallInsert.output).toEqual({ ok: true });
  });

  it("persists thread, messages and ai run after stream completes", async () => {
    const db = createDatabaseStub();
    const context = createContext();
    const aiResponse = createStreamAiResponse();
    const logger = createLoggerService();

    const service = createService({ aiResponse, database: db, logger });
    const result = await service.handleMessageStream(context);

    expect(result.isOk()).toBe(true);
    await vi.waitFor(async () => {
      const thread = await db.threads.getById(context.threadId);
      expect(thread).not.toBeNull();
    });

    const thread = await db.threads.getById(context.threadId);
    expect(thread?.text).toBe("Hello");
    expect(thread?.responseText).toBe("Hello");

    const messages = await db.messages.listByThread({
      threadId: context.threadId,
    });
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.role)).toEqual(
      expect.arrayContaining(["user", "assistant"])
    );

    const [aiRun] = await db.aiRuns.listByThread({
      threadId: context.threadId,
    });
    expect(aiRun?.mode).toBe("stream");
    expect(aiRun?.hadError).toBe(false);
  });
});
