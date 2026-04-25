import type { Bot } from "@goodchat/contracts/config/types";
import { Result } from "better-result";
import { describe, expect, it, vi } from "vitest";
import type { ChatResponseService } from "../chat-response/interface";
import type {
  ChatGatewayHandlers,
  ChatGatewayService,
} from "../gateway/interface";
import type { LoggerService } from "../logger/interface";
import { createDatabaseStub } from "../test-utils/database-stub";
import { registerGatewayMessageHandlers } from "./gateway-message-processor";

const createLogger = () => ({
  emit: vi.fn(() => null),
  error: vi.fn(),
  getContext: vi.fn(() => ({})),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
});

const createLoggerService = (
  requestLogger = createLogger()
): LoggerService => ({
  event: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  request: vi.fn(() => requestLogger),
  wide: vi.fn(() => createLogger()),
});

const createBot = (): Bot => ({
  auth: { enabled: false, mode: "password", webChatPublic: false },
  corsOrigin: undefined,
  dashboard: true,
  database: createDatabaseStub(),
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
  platforms: ["web"],
  plugins: [],
  prompt: "Be helpful",
  state: { adapter: "database" },
  tools: {},
});

const createGatewayHarness = () => {
  let handlers: ChatGatewayHandlers = {};

  const gateway: ChatGatewayService = {
    getAdapter: vi.fn(() => null),
    getPlatformIds: vi.fn(() => []),
    getWebhooks: vi.fn(() => ({})),
    initialize: vi.fn(async () => undefined),
    registerHandlers: vi.fn((input: ChatGatewayHandlers) => {
      handlers = input;
    }),
    shutdown: vi.fn(async () => undefined),
  };

  return {
    gateway,
    getHandlers: () => handlers,
  };
};

describe("registerGatewayMessageHandlers", () => {
  it("posts fallback error when thread platform is invalid", async () => {
    const ai: ChatResponseService = {
      handleMessage: vi.fn(),
      handleMessageStream: vi.fn(),
    };
    const logger = createLoggerService();
    const { gateway, getHandlers } = createGatewayHarness();

    registerGatewayMessageHandlers(gateway, {
      bot: createBot(),
      chatResponse: ai,
      logger,
    });

    const thread = {
      id: "unknown:thread-1",
      post: vi.fn(async () => undefined),
      subscribe: vi.fn(async () => undefined),
    };
    const message = { author: { userId: "user-1" }, text: "Hello" };

    await getHandlers().onNewMention?.(thread as never, message as never);

    expect(ai.handleMessage).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(
      "Sorry, I ran into an error while responding."
    );
  });

  it("posts fallback error when response service throws", async () => {
    const ai: ChatResponseService = {
      handleMessage: vi.fn(() => {
        throw new Error("boom");
      }),
      handleMessageStream: vi.fn(),
    };
    const logger = createLoggerService();
    const { gateway, getHandlers } = createGatewayHarness();

    registerGatewayMessageHandlers(gateway, {
      bot: createBot(),
      chatResponse: ai,
      logger,
    });

    const thread = {
      id: "web:thread-1",
      post: vi.fn(async () => undefined),
      subscribe: vi.fn(async () => undefined),
    };
    const message = { author: { userId: "user-1" }, text: "Hello" };

    await getHandlers().onSubscribedMessage?.(
      thread as never,
      message as never
    );

    expect(ai.handleMessage).toHaveBeenCalledTimes(1);
    expect(thread.post).toHaveBeenCalledWith(
      "Sorry, I ran into an error while responding."
    );
  });

  it("subscribes mentions and posts successful response", async () => {
    const ai: ChatResponseService = {
      handleMessage: vi.fn(async () =>
        Result.ok({ text: "AI: Hello", threadEntryId: "web:thread-1" })
      ),
      handleMessageStream: vi.fn(),
    };
    const logger = createLoggerService();
    const { gateway, getHandlers } = createGatewayHarness();

    registerGatewayMessageHandlers(gateway, {
      bot: createBot(),
      chatResponse: ai,
      logger,
    });

    const thread = {
      id: "web:thread-1",
      post: vi.fn(async () => undefined),
      subscribe: vi.fn(async () => undefined),
    };
    const message = { author: { userId: "user-1" }, text: "Hello" };

    await getHandlers().onNewMention?.(thread as never, message as never);

    expect(thread.subscribe).toHaveBeenCalledTimes(1);
    expect(thread.post).toHaveBeenCalledWith("AI: Hello");
  });
});
