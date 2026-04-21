import type { DiscordAdapter } from "@chat-adapter/discord";
import { cron, Patterns } from "@elysiajs/cron";
import type { Bot, Platform } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";
import type { ChatGatewayService } from "../gateway/interface";
import type { LoggerService } from "../logger/interface";

export interface WebhookEnv {
  CRON_SECRET?: string;
  WEBHOOK_FORWARD_URL?: string;
}

const gatewayListenerDurationMs = 10 * 60 * 1000;
const gatewayCronIntervalMinutes = 9;
const gatewayCronPattern = Patterns.everyMinutes(gatewayCronIntervalMinutes);
const gatewayAbortControllers = new Map<string, AbortController>();

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

const getDefaultBaseUrl = (env: WebhookEnv) =>
  env.WEBHOOK_FORWARD_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

interface WebhookChatControllerOptions {
  botId: Bot["id"];
  gateway: ChatGatewayService;
  isServerless: Bot["isServerless"];
  logger: LoggerService;
}

export const webhookChatController = ({
  botId,
  isServerless,
  gateway,
  logger,
}: WebhookChatControllerOptions) => {
  const app = new Elysia({ prefix: "/webhook" });
  const platforms = gateway.getPlatformIds();
  const hasDiscordBots = platforms.includes("discord");

  const env = {
    CRON_SECRET: process.env.CRON_SECRET,
    WEBHOOK_FORWARD_URL: process.env.WEBHOOK_FORWARD_URL,
  };

  const startDiscordGatewayListener = async (
    webhookUrl: string,
    abortSignal?: AbortSignal
  ) => {
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

  const handlePlatformWebhook = (
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
      const webhookBaseUrl = env.WEBHOOK_FORWARD_URL ?? url.origin;
      const webhookUrl = buildDiscordWebhookUrl(
        webhookBaseUrl,
        url.searchParams.get("webhookUrl")
      );

      const existingController = gatewayAbortControllers.get(botId);
      if (existingController) {
        existingController.abort();
      }

      const controller = new AbortController();
      gatewayAbortControllers.set(botId, controller);

      setTimeout(() => {
        const currentController = gatewayAbortControllers.get(botId);
        if (currentController === controller) {
          gatewayAbortControllers.delete(botId);
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

    const baseUrl = getDefaultBaseUrl(env);
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
