import type { BotConfigInput } from "@goodchat/contracts/config/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseStub } from "./test-utils/database-stub";

const BASE_CONFIG: BotConfigInput = {
  name: "Test Bot",
  prompt: "Be helpful",
  platforms: ["web"],
  model: { provider: "openai", modelId: "gpt-4.1-mini" },
  database: createDatabaseStub(),
  dashboard: false,
};

const createTestApp = async (isServerless: boolean) => {
  const initializeGateway = vi.fn(async () => ({
    getAdapter: vi.fn(() => null),
    getPlatformIds: vi.fn(() => []),
    getWebhooks: vi.fn(() => ({})),
    initialize: vi.fn(async () => undefined),
    registerHandlers: vi.fn(),
    shutdown: vi.fn(async () => undefined),
  }));

  vi.doMock("./runtime/create-chat-runtime", () => ({
    createChatRuntime: vi.fn(() => ({
      initializeGateway,
      chatResponse: {
        handleMessage: vi.fn(),
        handleMessageStream: vi.fn(),
      },
    })),
  }));

  const { createGoodchat } = await import("./index");
  await createGoodchat({
    ...BASE_CONFIG,
    isServerless,
  }).ready;

  return { initializeGateway };
};

describe("createGoodchat gateway initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  });

  it("skips explicit gateway initialization in serverless mode", async () => {
    const { initializeGateway } = await createTestApp(true);

    expect(initializeGateway).not.toHaveBeenCalled();
  });

  it("initializes gateway during startup outside serverless mode", async () => {
    const { initializeGateway } = await createTestApp(false);

    expect(initializeGateway).toHaveBeenCalledTimes(1);
  });
});
