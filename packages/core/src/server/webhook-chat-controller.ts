import type { DiscordAdapter } from "@chat-adapter/discord";
import { cron, Patterns } from "@elysiajs/cron";
import { Elysia } from "elysia";
import type { BotConfig, Platform } from "../config/models";
import type { ChatRuntime } from "../runtime/create-chat-runtime";

export interface WebhookEnv {
  CRON_SECRET?: string;
  NODE_ENV?: string;
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
  const requiresSecret =
    env.NODE_ENV === "production" || Boolean(env.CRON_SECRET);
  if (!requiresSecret) {
    return { ok: true as const };
  }

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
  botConfig: BotConfig;
  chatRuntime: ChatRuntime;
  env: WebhookEnv;
  isServerless: boolean;
}

export const webhookChatController = ({
  botConfig,
  chatRuntime,
  env,
  isServerless,
}: WebhookChatControllerOptions) => {
  const app = new Elysia({ prefix: "/webhook" });
  const hasDiscordBots = botConfig.platforms.includes("discord");

  const startDiscordGatewayListener = async (
    webhookUrl: string,
    abortSignal?: AbortSignal
  ) => {
    const discordAdapter = chatRuntime.gateway.getAdapter(
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
    if (!botConfig.platforms.includes(platform)) {
      set.status = 404;
      return { message: "Platform not configured" };
    }

    const webhooks = chatRuntime.gateway.getWebhooks();
    const handler = webhooks[platform as keyof typeof webhooks];
    if (!handler) {
      set.status = 404;
      return { message: "Platform webhook not configured" };
    }

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

  if (botConfig.platforms.includes("discord")) {
    app.post("/discord", createPlatformHandler("discord"));
  }

  if (botConfig.platforms.includes("slack")) {
    app.post("/slack", createPlatformHandler("slack"));
  }

  if (botConfig.platforms.includes("teams")) {
    app.post("/teams", createPlatformHandler("teams"));
  }

  if (botConfig.platforms.includes("gchat")) {
    app.post("/gchat", createPlatformHandler("gchat"));
  }

  if (botConfig.platforms.includes("local")) {
    app.post("/local", createPlatformHandler("local"));
  }

  if (hasDiscordBots) {
    app.get(
      "/discord/gateway",
      async ({
        request,
        set,
      }: {
        request: Request;
        set: { status?: number };
      }) => {
        if (!botConfig.platforms.includes("discord")) {
          set.status = 404;
          return { message: "Discord adapter not configured" };
        }

        const authResult = isCronAuthorized(request, env);
        if (!authResult.ok) {
          set.status = authResult.status;
          return { message: authResult.message };
        }

        const url = new URL(request.url);
        const webhookBaseUrl = env.WEBHOOK_FORWARD_URL ?? url.origin;
        const webhookUrl = buildDiscordWebhookUrl(
          webhookBaseUrl,
          url.searchParams.get("webhookUrl")
        );

        const existingController = gatewayAbortControllers.get(botConfig.id);
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        gatewayAbortControllers.set(botConfig.id, controller);

        setTimeout(() => {
          const currentController = gatewayAbortControllers.get(botConfig.id);
          if (currentController === controller) {
            gatewayAbortControllers.delete(botConfig.id);
          }
        }, gatewayListenerDurationMs + 1000);

        const startResult = await startDiscordGatewayListener(
          webhookUrl,
          controller.signal
        );

        if (!startResult.ok) {
          set.status = startResult.status;
          return { message: startResult.message };
        }

        return startResult.response;
      }
    );
  }

  const runDiscordGatewayKeepalive = async () => {
    if (!botConfig.platforms.includes("discord")) {
      return;
    }

    const baseUrl = getDefaultBaseUrl(env);
    const gatewayUrl = new URL("/api/webhook/discord/gateway", baseUrl);

    const response = await fetch(gatewayUrl, {
      method: "GET",
      headers: env.CRON_SECRET
        ? {
            "x-cron-secret": env.CRON_SECRET,
          }
        : undefined,
    });

    if (!response.ok) {
      console.warn(
        `Discord gateway cron failed for ${botConfig.id}: ${response.status}`
      );
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
