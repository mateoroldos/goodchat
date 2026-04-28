import type { Platform } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatGatewayService } from "../gateway/interface";
import { NoopLoggerService } from "../logger/service";
import { webhookChatController } from "./webhook-chat-controller";

const createGateway = ({
  initialize = vi.fn(async () => undefined),
  platforms = ["slack"] as Platform[],
  webhooks = {},
  discordAdapter = null,
}: {
  discordAdapter?: unknown;
  initialize?: () => Promise<void>;
  platforms?: Platform[];
  webhooks?: Record<string, (request: Request) => Promise<Response> | Response>;
}): ChatGatewayService => ({
  getAdapter: vi.fn((name: Platform) =>
    name === "discord" ? (discordAdapter as never) : null
  ),
  getPlatformIds: vi.fn(() => platforms),
  getWebhooks: vi.fn(() => webhooks as never),
  initialize,
  registerHandlers: vi.fn(),
  shutdown: vi.fn(async () => undefined),
});

const createApp = (gateway: ChatGatewayService, isServerless = true) =>
  new Elysia().use(
    webhookChatController({
      initializeGateway: async () => {
        await gateway.initialize();
        return gateway;
      },
      isServerless,
      logger: new NoopLoggerService(),
      platforms: gateway.getPlatformIds() as Platform[],
    })
  );

describe("webhookChatController gateway initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("initializes gateway before forwarding platform webhooks", async () => {
    const initialize = vi.fn(async () => undefined);
    const slackWebhook = vi.fn(async () => new Response("ok", { status: 200 }));
    const gateway = createGateway({
      initialize,
      platforms: ["slack"],
      webhooks: { slack: slackWebhook },
    });
    const app = createApp(gateway);

    const response = await app.handle(
      new Request("http://localhost/webhook/slack", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(slackWebhook).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when gateway initialization fails for platform webhook", async () => {
    const initialize = vi.fn(() => Promise.reject(new Error("boom")));
    const slackWebhook = vi.fn(async () => new Response("ok", { status: 200 }));
    const gateway = createGateway({
      initialize,
      platforms: ["slack"],
      webhooks: { slack: slackWebhook },
    });
    const app = createApp(gateway);

    const response = await app.handle(
      new Request("http://localhost/webhook/slack", {
        method: "POST",
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Gateway unavailable",
    });
    expect(slackWebhook).not.toHaveBeenCalled();
  });

  it("initializes gateway before starting discord gateway listener", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    const initialize = vi.fn(async () => undefined);
    const startGatewayListener = vi.fn(async () => ({ ok: true }));
    const gateway = createGateway({
      initialize,
      platforms: ["discord"],
      discordAdapter: {
        startGatewayListener,
      },
    });
    const app = createApp(gateway);

    const response = await app.handle(
      new Request(
        "http://localhost/webhook/discord/gateway?cronSecret=secret&webhookUrl=https://example.com/hook",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(startGatewayListener).toHaveBeenCalledTimes(1);
  });

  it("uses request origin by default for discord gateway listener webhook URL", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    const startGatewayListener = vi.fn(async () => ({ ok: true }));
    const gateway = createGateway({
      initialize: vi.fn(async () => undefined),
      platforms: ["discord"],
      discordAdapter: {
        startGatewayListener,
      },
    });
    const app = createApp(gateway);

    const response = await app.handle(
      new Request(
        "http://localhost/webhook/discord/gateway?cronSecret=secret",
        {
          method: "GET",
        }
      )
    );

    expect(response.status).toBe(200);
    expect(startGatewayListener).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Number),
      expect.any(Object),
      "http://localhost/api/webhook/discord"
    );
  });
});
