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

const createDatabase = (
  overrides: { transaction?: Database["transaction"] } = {}
): Database => {
  const database = {
    aiRunToolCalls: { create: vi.fn() },
    aiRuns: { create: vi.fn() },
    dialect: "sqlite",
    messages: { create: vi.fn() },
    threads: {
      create: vi.fn(),
      getById: vi.fn(async () => null),
      update: vi.fn(),
    },
  } as unknown as Database;

  const transaction =
    overrides.transaction ??
    (async (callback: Parameters<Database["transaction"]>[0]) =>
      callback(database));

  return {
    ...database,
    transaction,
  };
};

const createContext = (text = "Hello"): MessageContext => ({
  adapterName: "local",
  botId: "bot-id",
  botName: "Echo",
  platform: "local",
  text,
  threadId: "thread-1",
  userId: "user-1",
});

const createService = ({
  aiResponse,
  logger,
  bot,
}: {
  aiResponse: AiResponseService;
  bot?: Bot;
  logger: LoggerService;
}) => {
  const database = createDatabase();
  return new DefaultChatResponseService({
    aiResponse,
    bot:
      bot ??
      ({
        auth: { enabled: false, localChatPublic: false, mode: "password" },
        corsOrigin: undefined,
        database,
        hooks: {
          afterMessage: [],
          beforeMessage: [],
        },
        id: "bot-id",
        isServerless: false,
        logging: { enabled: true },
        mcp: [],
        model: { modelId: "gpt-4.1-mini", provider: "openai" },
        name: "Echo",
        platforms: ["local"],
        plugins: [],
        prompt: "Be helpful",
        tools: {},
        withDashboard: true,
      } as Bot),
    logger,
  });
};

const waitForAssertion = async (assertion: () => void) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      assertion();
      return;
    } catch {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    }
  }

  assertion();
};

describe("DefaultChatResponseService", () => {
  it("returns input validation error when message text is empty", async () => {
    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(),
    };
    const logger: LoggerService = {
      event: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      request: vi.fn(() => createLogger()),
      wide: vi.fn(() => createLogger()),
    };

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
    const logger: LoggerService = {
      event: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      request: vi.fn(() => requestLogger),
      wide: vi.fn(() => createLogger()),
    };

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

  it("uses background logger for stream persistence failures", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const backgroundLogger = createLogger();
    const db = createDatabase({
      transaction: () => Promise.reject(new Error("db down")),
    });

    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(async () =>
        Result.ok({
          telemetry: Promise.resolve(createTelemetry("stream")),
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
    };
    const logger: LoggerService = {
      event: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      request: vi.fn(() => requestLogger),
      wide: vi.fn(() => backgroundLogger),
    };

    const service = createService({
      aiResponse,
      bot: {
        auth: { enabled: false, localChatPublic: false, mode: "password" },
        corsOrigin: undefined,
        database: db,
        hooks: {
          afterMessage: [],
          beforeMessage: [],
        },
        id: "bot-id",
        isServerless: false,
        logging: { enabled: true },
        mcp: [],
        model: { modelId: "gpt-4.1-mini", provider: "openai" },
        name: "Echo",
        platforms: ["local"],
        plugins: [],
        prompt: "Be helpful",
        tools: {},
        withDashboard: true,
      },
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await waitForAssertion(() => {
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

    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(async () =>
        Result.ok({
          telemetry: Promise.resolve(createTelemetry("stream")),
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
    };
    const logger: LoggerService = {
      event: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      request: vi.fn(() => requestLogger),
      wide: vi.fn(() => backgroundLogger),
    };

    const service = createService({
      aiResponse,
      bot: {
        auth: { enabled: false, localChatPublic: false, mode: "password" },
        corsOrigin: undefined,
        database: createDatabase(),
        hooks: {
          afterMessage: [afterHook],
          beforeMessage: [],
        },
        id: "bot-id",
        isServerless: false,
        logging: { enabled: true },
        mcp: [],
        model: { modelId: "gpt-4.1-mini", provider: "openai" },
        name: "Echo",
        platforms: ["local"],
        plugins: [],
        prompt: "Be helpful",
        tools: {},
        withDashboard: true,
      },
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await waitForAssertion(() => {
      expect(afterHook).toHaveBeenCalledTimes(1);
      expect(backgroundLogger.emit).toHaveBeenCalledTimes(1);
    });
    expect(afterHook.mock.calls[0]?.[0]?.log).toBe(backgroundLogger);
  });

  it("sanitizes non-json telemetry before persisting ai run data", async () => {
    const requestLogger = createLogger({ requestId: "req-1" });
    const backgroundLogger = createLogger();
    const db = createDatabase();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const aiResponse: AiResponseService = {
      generate: vi.fn(),
      stream: vi.fn(async () =>
        Result.ok({
          telemetry: Promise.resolve({
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
          }),
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
    };

    const logger: LoggerService = {
      event: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      request: vi.fn(() => requestLogger),
      wide: vi.fn(() => backgroundLogger),
    };

    const service = createService({
      aiResponse,
      bot: {
        auth: { enabled: false, localChatPublic: false, mode: "password" },
        corsOrigin: undefined,
        database: db,
        hooks: {
          afterMessage: [],
          beforeMessage: [],
        },
        id: "bot-id",
        isServerless: false,
        logging: { enabled: true },
        mcp: [],
        model: { modelId: "gpt-4.1-mini", provider: "openai" },
        name: "Echo",
        platforms: ["local"],
        plugins: [],
        prompt: "Be helpful",
        tools: {},
        withDashboard: true,
      },
      logger,
    });

    const result = await service.handleMessageStream(createContext());

    expect(result.isOk()).toBe(true);
    await waitForAssertion(() => {
      expect(backgroundLogger.emit).toHaveBeenCalledTimes(1);
      expect(
        db.aiRuns.create as unknown as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledTimes(1);
      expect(
        db.aiRunToolCalls.create as unknown as ReturnType<typeof vi.fn>
      ).toHaveBeenCalledTimes(1);
    });
    expect(backgroundLogger.error).not.toHaveBeenCalled();

    const aiRunInsert = (
      db.aiRuns.create as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0];
    expect(aiRunInsert.providerMetadata).toBeUndefined();
    expect(aiRunInsert.usage).toEqual({ count: "2", ok: true });

    const toolCallInsert = (
      db.aiRunToolCalls.create as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0];
    expect(toolCallInsert.error).toBeUndefined();
    expect(toolCallInsert.input).toEqual({ count: "4" });
    expect(toolCallInsert.output).toEqual({ ok: true });
  });
});
