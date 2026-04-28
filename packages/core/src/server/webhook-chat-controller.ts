import type { DiscordAdapter } from "@chat-adapter/discord";
import { cron, Patterns } from "@elysiajs/cron";
import type { Bot, Platform } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";
import type { ChatGatewayService } from "../gateway/interface";
import type { LoggerService } from "../logger/interface";

export interface WebhookEnv {
  CRON_SECRET?: string;
}

const gatewayListenerDurationMs = 10 * 60 * 1000;
const gatewayCronIntervalMinutes = 9;
const gatewayCronPattern = Patterns.everyMinutes(gatewayCronIntervalMinutes);
let gatewayAbortController: AbortController | null = null;

const getCronSecret = (request: Request) => {
  const url = new URL(request.url);
  return (
    request.headers.get("x-cron-secret") ?? url.searchParams.get("cronSecret")
  );
};

const isCronAuthorized = (request: Request, env: WebhookEnv) => {
  if (!env.CRON_SECRET) {
    return {
      ok: false as const,
      status: 500,
      message: "CRON_SECRET is not set",
    };
  }

  const provided = getCronSecret(request);
  if (provided !== env.CRON_SECRET) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  return { ok: true as const };
};

const buildDiscordWebhookUrl = (baseUrl: string, overrideUrl?: string | null) =>
  overrideUrl ?? new URL("/api/webhook/discord", baseUrl).toString();

const getDefaultBaseUrl = () => `http://localhost:${process.env.PORT ?? 3000}`;

interface WebhookChatControllerOptions {
  initializeGateway: () => Promise<ChatGatewayService>;
  isServerless: Bot["isServerless"];
  logger: LoggerService;
  platforms: Bot["platforms"];
}

export const webhookChatController = ({
  initializeGateway,
  isServerless,
  logger,
  platforms,
}: WebhookChatControllerOptions) => {
  const app = new Elysia({ prefix: "/webhook" });
  const hasDiscordBots = platforms.includes("discord");

  const ensureGatewayReady = async (): Promise<
    { ok: true; gateway: ChatGatewayService } | { error: unknown; ok: false }
  > => {
    try {
      const gateway = await initializeGateway();
      return { ok: true, gateway };
    } catch (error) {
      return { ok: false, error };
    }
  };

  const env = {
    CRON_SECRET: process.env.CRON_SECRET,
  };

  const startDiscordGatewayListener = async (
    webhookUrl: string,
    abortSignal?: AbortSignal
  ) => {
    const gatewayResult = await ensureGatewayReady();
    if (!gatewayResult.ok) {
      return {
        ok: false as const,
        status: 503,
        message: "Gateway unavailable",
      };
    }
    const gateway = gatewayResult.gateway;

    const discordAdapter = gateway.getAdapter(
      "discord"
    ) as DiscordAdapter | null;

    if (!discordAdapter) {
      return {
        ok: false as const,
        status: 404,
        message: "Discord adapter not configured",
      };
    }

    const response = await discordAdapter.startGatewayListener(
      {
        waitUntil: (task) => {
          task.catch(() => undefined);
        },
      },
      gatewayListenerDurationMs,
      abortSignal,
      webhookUrl
    );

    return { ok: true as const, response };
  };

  const handlePlatformWebhook = async (
    platform: Platform,
    request: Request,
    set: { status?: number | string }
  ) => {
    const log = logger.request();
    log?.set({
      platform,
      webhook: {
        method: request.method,
      },
    });

    if (!platforms.includes(platform)) {
      set.status = 404;
      log?.warn("Webhook requested for disabled platform", {
        error: {
          code: "WEBHOOK_PLATFORM_NOT_CONFIGURED",
          fix: "Enable the platform in createGoodchat({ platforms: [...] }).",
          why: "The webhook path was hit for a platform that is not configured.",
        },
      });
      return { message: "Platform not configured" };
    }

    const gatewayResult = await ensureGatewayReady();
    if (!gatewayResult.ok) {
      set.status = 503;
      log?.warn("Webhook request failed while initializing gateway", {
        error: {
          code: "WEBHOOK_GATEWAY_UNAVAILABLE",
          fix: "Verify chat adapter credentials and state adapter connectivity.",
          message:
            gatewayResult.error instanceof Error
              ? gatewayResult.error.message
              : "Unknown error",
          type:
            gatewayResult.error instanceof Error
              ? gatewayResult.error.name
              : "UnknownError",
          why: "The chat gateway failed to initialize before handling webhook traffic.",
        },
      });
      return { message: "Gateway unavailable" };
    }
    const gateway = gatewayResult.gateway;

    const webhooks = gateway.getWebhooks();
    const handler = webhooks[platform as keyof typeof webhooks];
    if (!handler) {
      set.status = 404;
      log?.warn("Webhook handler missing for configured platform", {
        error: {
          code: "WEBHOOK_HANDLER_NOT_CONFIGURED",
          fix: "Ensure the adapter exposes a webhook handler for this platform.",
          why: "The gateway did not register a webhook handler for the platform.",
        },
      });
      return { message: "Platform webhook not configured" };
    }

    log?.set({ outcome: { status: "forwarded" } });
    return handler(request);
  };

  const createPlatformHandler =
    (platform: Platform) =>
    ({
      request,
      set,
    }: {
      request: Request;
      set: { status?: number | string };
    }) =>
      handlePlatformWebhook(platform, request, set);

  if (platforms.includes("discord")) {
    app.post("/discord", createPlatformHandler("discord"));
  }

  if (platforms.includes("slack")) {
    app.post("/slack", createPlatformHandler("slack"));
  }

  if (platforms.includes("teams")) {
    app.post("/teams", createPlatformHandler("teams"));
  }

  if (platforms.includes("gchat")) {
    app.post("/gchat", createPlatformHandler("gchat"));
  }

  if (platforms.includes("web")) {
    app.post("/local", createPlatformHandler("web"));
  }

  if (hasDiscordBots) {
    app.get("/discord/gateway", async ({ request, set }) => {
      const log = logger.request();
      log.set({
        platform: "discord",
        request: { kind: "gateway-keepalive" },
      });

      if (!platforms.includes("discord")) {
        set.status = 404;
        log.warn("Discord gateway requested while discord is disabled", {
          error: {
            code: "DISCORD_PLATFORM_NOT_CONFIGURED",
            fix: "Enable discord in createGoodchat({ platforms: [...] }).",
            why: "The discord gateway endpoint was called without discord being configured.",
          },
        });
        return { message: "Discord adapter not configured" };
      }

      const authResult = isCronAuthorized(request, env);
      if (!authResult.ok) {
        set.status = authResult.status;
        log.warn("Discord gateway keepalive authorization failed", {
          error: {
            code: "DISCORD_GATEWAY_CRON_UNAUTHORIZED",
            fix: "Provide x-cron-secret matching CRON_SECRET.",
            why: authResult.message,
          },
        });
        return { message: authResult.message };
      }

      const url = new URL(request.url);
      const webhookBaseUrl = url.origin;
      const webhookUrl = buildDiscordWebhookUrl(
        webhookBaseUrl,
        url.searchParams.get("webhookUrl")
      );

      if (gatewayAbortController) {
        gatewayAbortController.abort();
      }

      const controller = new AbortController();
      gatewayAbortController = controller;

      setTimeout(() => {
        if (gatewayAbortController === controller) {
          gatewayAbortController = null;
        }
      }, gatewayListenerDurationMs + 1000);

      const startResult = await startDiscordGatewayListener(
        webhookUrl,
        controller.signal
      );

      if (!startResult.ok) {
        set.status = startResult.status;
        log.warn("Discord gateway listener failed to start", {
          error: {
            code: "DISCORD_GATEWAY_START_FAILED",
            fix: "Verify discord adapter credentials and webhook forwarding URL.",
            why: startResult.message,
          },
        });
        return { message: startResult.message };
      }

      log.set({ outcome: { status: "success" } });

      return startResult.response;
    });
  }

  const runDiscordGatewayKeepalive = async () => {
    const log = logger.wide({
      job: { name: "discord-gateway-keepalive" },
      platform: "discord",
    });

    if (!platforms.includes("discord")) {
      log.set({ outcome: { status: "skipped" } });
      log.emit();
      return;
    }

    const baseUrl = getDefaultBaseUrl();
    const gatewayUrl = new URL("/api/webhook/discord/gateway", baseUrl);

    try {
      const response = await fetch(gatewayUrl, {
        method: "GET",
        headers: env.CRON_SECRET
          ? {
              "x-cron-secret": env.CRON_SECRET,
            }
          : undefined,
      });

      if (!response.ok) {
        log.warn("Discord gateway keepalive request failed", {
          error: {
            code: "DISCORD_GATEWAY_KEEPALIVE_FAILED",
            fix: "Check webhook base URL, CRON_SECRET, and discord adapter health.",
            why: `Keepalive endpoint returned status ${response.status}.`,
          },
          response: {
            status: response.status,
          },
        });
      }

      log.set({
        outcome: { status: response.ok ? "success" : "error" },
        response: { status: response.status },
      });
    } catch (error) {
      log.error("Discord gateway keepalive request threw", {
        error: {
          code: "DISCORD_GATEWAY_KEEPALIVE_ERROR",
          fix: "Check network reachability and webhook forwarding URL.",
          message: error instanceof Error ? error.message : "Unknown error",
          type: error instanceof Error ? error.name : "UnknownError",
          why: "The keepalive fetch call failed before a response was received.",
        },
      });
      throw error;
    } finally {
      log.emit();
    }
  };

  if (!isServerless && hasDiscordBots) {
    app.use(
      cron({
        name: "discord-gateway-keepalive",
        pattern: gatewayCronPattern,
        run: runDiscordGatewayKeepalive,
      })
    );

    setTimeout(() => {
      runDiscordGatewayKeepalive().catch(() => undefined);
    }, 5000);
  }

  return app;
};
