import type { DiscordAdapter } from "@chat-adapter/discord";
import { cron, Patterns } from "@elysiajs/cron";
import type { Platform } from "@goodchat/core/config/models";
import { Elysia } from "elysia";
import { env } from "../../env";
import type { BotRegistry } from "../../runtime/bot-registry";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const gatewayListenerDurationMs = 10 * 60 * 1000;
const gatewayCronIntervalMinutes = 9;
const gatewayCronPattern = Patterns.everyMinutes(gatewayCronIntervalMinutes);

const getCronSecret = (request: Request) => {
  const url = new URL(request.url);
  return (
    request.headers.get("x-cron-secret") ?? url.searchParams.get("cronSecret")
  );
};

const isCronAuthorized = (request: Request) => {
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

const buildWebhookUrl = (
  botId: string,
  baseUrl: string,
  overrideUrl?: string | null
) =>
  overrideUrl ?? new URL(`/api/webhook/${botId}/discord`, baseUrl).toString();

const getDefaultBaseUrl = () =>
  env.WEBHOOK_FORWARD_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

export const webhookChatController = (registry: BotRegistry) => {
  const app = new Elysia({ prefix: "/webhook" });
  const hasDiscordBots = registry
    .listBots()
    .some((bot) => bot.platforms.includes("discord"));

  const startDiscordGatewayListener = async (
    botId: string,
    webhookUrl: string
  ) => {
    const runtimeResult = registry.getRuntime(botId);
    if (runtimeResult.isErr()) {
      return {
        ok: false as const,
        status: runtimeResult.error.code === "BOT_NOT_FOUND" ? 404 : 500,
        message: runtimeResult.error.message,
      };
    }

    const runtime = runtimeResult.value;
    const discordAdapter = runtime.gateway.getAdapter(
      "discord"
    ) as DiscordAdapter | null;

    if (!discordAdapter) {
      return {
        ok: false as const,
        status: 404,
        message: "Discord adapter not configured",
      };
    }

    await runtime.gateway.initialize();

    const response = await discordAdapter.startGatewayListener(
      {
        waitUntil: (task) => {
          task.catch(() => undefined);
        },
      },
      gatewayListenerDurationMs,
      undefined,
      webhookUrl
    );

    return { ok: true as const, response };
  };

  app.post("/:botId/:platform", ({ params, request, set }) => {
    const botConfig = registry.getConfig(params.botId);
    if (!botConfig) {
      set.status = 404;
      return { message: "Bot not found" };
    }

    if (!botConfig.platforms.includes(params.platform as Platform)) {
      set.status = 404;
      return { message: "Platform not configured" };
    }

    const runtimeResult = registry.getRuntime(params.botId);
    if (runtimeResult.isErr()) {
      set.status = runtimeResult.error.code === "BOT_NOT_FOUND" ? 404 : 500;
      return { message: runtimeResult.error.message };
    }

    const runtime = runtimeResult.value;

    const webhooks = runtime.gateway.getWebhooks();
    const handler = webhooks[params.platform as keyof typeof webhooks];
    if (!handler) {
      set.status = 404;
      return { message: "Platform webhook not configured" };
    }

    return handler(request);
  });

  if (hasDiscordBots) {
    app.get("/:botId/discord/gateway", async ({ params, request, set }) => {
      const botConfig = registry.getConfig(params.botId);
      if (!botConfig) {
        set.status = 404;
        return { message: "Bot not found" };
      }

      if (!botConfig.platforms.includes("discord")) {
        set.status = 404;
        return { message: "Discord adapter not configured" };
      }

      const authResult = isCronAuthorized(request);
      if (!authResult.ok) {
        set.status = authResult.status;
        return { message: authResult.message };
      }

      const url = new URL(request.url);
      const webhookBaseUrl = env.WEBHOOK_FORWARD_URL ?? url.origin;
      const webhookUrl = buildWebhookUrl(
        params.botId,
        webhookBaseUrl,
        url.searchParams.get("webhookUrl")
      );

      const startResult = await startDiscordGatewayListener(
        params.botId,
        webhookUrl
      );

      if (!startResult.ok) {
        set.status = startResult.status;
        return { message: startResult.message };
      }

      return startResult.response;
    });
  }

  const runDiscordGatewayKeepalive = async () => {
    const bots = registry.listBots();
    const discordBots = bots.filter((bot) => bot.platforms.includes("discord"));
    const baseUrl = getDefaultBaseUrl();

    for (const bot of discordBots) {
      const gatewayUrl = new URL(
        `/api/webhook/${bot.id}/discord/gateway`,
        baseUrl
      );

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
          `Discord gateway cron failed for ${bot.id}: ${response.status}`
        );
      }
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
      runDiscordGatewayKeepalive();
    }, 5000);
  }

  return app;
};
