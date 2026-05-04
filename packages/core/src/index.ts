import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { botConfigSchema } from "@goodchat/contracts/config/models";
import type { Bot, BotConfigInput } from "@goodchat/contracts/config/types";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import { Elysia } from "elysia";
import { validateModelProviderConfig } from "./ai-response/provider-registry";
import {
  EvlogAiTelemetryService,
  NoopAiTelemetryService,
} from "./ai-telemetry/service";
import {
  createAuthRuntime,
  getBetterAuthOpenApiDocumentation,
  isSharedAuthPrincipal,
} from "./auth/better-auth";
import { bootstrapSharedAccount } from "./auth/bootstrap-shared-account";
import { mergePlugins, resolvePlugins } from "./extensions/merge";
import { ElysiaLoggerService, NoopLoggerService } from "./logger/service";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { verifyDatabaseMigrationReadiness } from "./runtime/migration-readiness";
import {
  createAuthApi,
  createWebChatApi,
  setupDashboard,
  setupOpenApiDocumentation,
  setupRequestLogging,
  type WebChatAccess,
} from "./server/app-bootstrap";
import { requireSessionGuard } from "./server/auth-guard";
import { botController } from "./server/bot-controller";
import { threadsController } from "./server/threads-controller";
import { webChatController } from "./server/web-chat-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

const sameOriginCors = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

type ResolvedWebChatAccess = "disabled" | WebChatAccess;

const resolveWebChatAccess = (input: {
  platforms: Bot["platforms"];
  auth: Bot["auth"];
}): ResolvedWebChatAccess => {
  if (!input.platforms.includes("web")) {
    return "disabled";
  }

  if (input.auth.enabled && !input.auth.webChatPublic) {
    return "protected";
  }

  return "public";
};

export const createGoodchat = (options: BotConfigInput) => {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: initialization intentionally wires the full runtime graph in one place.
  const initialize = async () => {
    const botConfig = botConfigSchema.parse(options);

    const merged = mergePlugins(resolvePlugins(botConfig), {
      hooks: botConfig.hooks ?? {},
      mcp: botConfig.mcp,
      tools: botConfig.tools,
    });

    const bot: Bot = {
      ...botConfig,
      id: botConfig.id ?? deriveBotId(botConfig.name),
      hooks: {
        afterMessage: merged.afterMessage,
        beforeMessage: merged.beforeMessage,
      },
      mcp: merged.mcp,
      tools: merged.tools,
      ...(merged.systemPrompt ? { systemPrompt: merged.systemPrompt } : {}),
    };

    const coreDir = dirname(fileURLToPath(import.meta.url));
    const packagedWebBuildPath = join(coreDir, "web");
    const webBuildPath = packagedWebBuildPath;

    validateModelProviderConfig(bot.model);

    const loggingEnabled = bot.logging.enabled !== false;
    const logger = loggingEnabled
      ? new ElysiaLoggerService(bot.logging?.service ?? bot.name)
      : new NoopLoggerService();
    const aiTelemetry = loggingEnabled
      ? new EvlogAiTelemetryService(logger)
      : new NoopAiTelemetryService();

    const authRuntime = createAuthRuntime({
      config: bot.auth,
      database: bot.database,
    });

    // Better Auth issues session cookies for persisted users, so shared-password
    // mode still needs one internal account to authenticate against.
    if (bot.auth.enabled && authRuntime && bot.auth.password) {
      await bootstrapSharedAccount({
        authRuntime,
        password: bot.auth.password,
      });
    }

    const webChatAccess = resolveWebChatAccess({
      platforms: bot.platforms,
      auth: bot.auth,
    });

    const chatRuntime = createChatRuntime({ aiTelemetry, bot, logger });

    await verifyDatabaseMigrationReadiness({
      botId: bot.id,
      database: bot.database,
      isServerless: bot.isServerless,
      pluginNames: (bot.plugins ?? []).map((plugin) => plugin.name),
    });

    // For non serverless environments we initialize the gateway on startup
    // For serverless environments we pass the initialization to webhook controller
    // so gatweay only boots when webhhoks are hit
    if (!bot.isServerless) {
      await chatRuntime.initializeGateway();
    }

    const authOpenApi = authRuntime
      ? await getBetterAuthOpenApiDocumentation(authRuntime.auth)
      : null;

    const app = new Elysia().use(
      cors({
        origin: bot.corsOrigin ?? sameOriginCors,
        methods: ["GET", "POST", "PATCH", "OPTIONS"],
      })
    );

    setupRequestLogging({
      app,
      drain: bot.logging?.drain,
      loggingEnabled,
    });
    setupOpenApiDocumentation({ app, authOpenApi });

    const publicApi = new Elysia()
      .use(
        webhookChatController({
          botId: bot.id,
          isServerless: bot.isServerless,
          logger,
          initializeGateway: chatRuntime.initializeGateway,
          platforms: bot.platforms,
        })
      )
      .get("/auth-status", async ({ request }) => {
        if (!(bot.auth.enabled && authRuntime)) {
          return { authenticated: true, enabled: false };
        }

        try {
          const session = await authRuntime.auth.api.getSession({
            headers: request.headers,
          });

          return {
            authenticated: isSharedAuthPrincipal(session),
            enabled: true,
          };
        } catch {
          return { authenticated: false, enabled: true };
        }
      })
      .get("/health", () => "OK");

    const protectedApiRoutes = new Elysia()
      .use(
        botController({
          id: bot.id,
          name: bot.name,
          prompt: bot.prompt,
          platforms: bot.platforms,
          model: bot.model,
        })
      )
      .use(
        threadsController({
          database: bot.database,
          botId: bot.id,
          logger,
        })
      );

    const protectedApi = bot.auth.enabled
      ? new Elysia()
          .onBeforeHandle(requireSessionGuard(authRuntime))
          .use(protectedApiRoutes)
      : protectedApiRoutes;

    const webChatApi = new Elysia().use(
      webChatController({
        botId: bot.id,
        botName: bot.name,
        logger,
        platforms: bot.platforms,
        responseHandler: chatRuntime.chatResponse,
      })
    );

    const authApi = createAuthApi(authRuntime);

    const maybeWebApi =
      webChatAccess === "disabled"
        ? new Elysia()
        : createWebChatApi({
            webApi: webChatApi,
            authRuntime,
            access: webChatAccess,
          });

    const api = new Elysia({ prefix: "/api" })
      .use(authApi)
      .use(publicApi)
      .use(protectedApi)
      .use(maybeWebApi);

    app.use(api);

    setupDashboard({
      app,
      webBuildPath,
      dashboard: bot.dashboard,
    });

    return { app, api, chatRuntime };
  };

  let _ready: ReturnType<typeof initialize> | undefined;

  return {
    name: options.name,
    database: { dialect: options.database.dialect },
    auth: options.auth,
    plugins: options.plugins,
    get ready() {
      _ready ??= initialize();
      return _ready;
    },
  };
};

export type GoodchatApi = Awaited<
  ReturnType<typeof createGoodchat>["ready"]
>["api"];

// biome-ignore lint/performance/noBarrelFile: drizzle-kit relies on exported table symbols
export { aiGateway } from "@goodchat/contracts/model/catalog/ai-gateway";
export { anthropic } from "@goodchat/contracts/model/catalog/anthropic";
export { google } from "@goodchat/contracts/model/catalog/google";
export { openai } from "@goodchat/contracts/model/catalog/openai";
export { openrouter } from "@goodchat/contracts/model/catalog/openrouter";
export { vercelGateway } from "@goodchat/contracts/model/catalog/vercel-gateway";
