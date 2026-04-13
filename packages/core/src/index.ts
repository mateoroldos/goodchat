import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import {
  mcpServerSchema,
  toolSchema,
} from "@goodchat/contracts/capabilities/models";
import {
  authConfigSchema,
  botConfigSchema,
  databaseDialectSchema,
} from "@goodchat/contracts/config/models";
import type { BotConfig } from "@goodchat/contracts/config/types";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import type { Database } from "@goodchat/contracts/database/interface";
import { goodchatHooksSchema } from "@goodchat/contracts/hooks/models";
import {
  goodchatPluginDefinitionSchema,
  goodchatPluginFactorySchema,
  goodchatPluginSchema,
} from "@goodchat/contracts/plugins/models";
import type { GoodchatPlugin } from "@goodchat/contracts/plugins/types";
import {
  isPluginDefinition,
  isPluginFactory,
} from "@goodchat/contracts/plugins/types";
import { Elysia } from "elysia";
import z from "zod";
import {
  createAuthRuntime,
  getBetterAuthOpenApiDocumentation,
} from "./auth/better-auth";
import { bootstrapSharedAccount } from "./auth/bootstrap-shared-account";
import { validatePluginEnv, validatePluginParams } from "./extensions/env";
import { mergePlugins } from "./extensions/merge";
import { createChatRuntime } from "./runtime/create-chat-runtime";
import { requireSessionGuard } from "./server/auth-guard";
import { botController } from "./server/bot-controller";
import { localChatController } from "./server/local-chat-controller";
import { threadsController } from "./server/threads-controller";
import { webhookChatController } from "./server/webhook-chat-controller";

const corsOriginSchema = z.custom<string | ((request: Request) => boolean)>(
  (value) => typeof value === "string" || typeof value === "function",
  {
    message: "CORS origin must be a string or function",
  }
);

export const goodchatOptionsSchema = botConfigSchema.extend({
  corsOrigin: corsOriginSchema.optional(),
  hooks: goodchatHooksSchema.optional(),
  id: z.string().min(1, "Bot id is required").optional(),
  isServerless: z.boolean().optional(),
  mcp: z.array(mcpServerSchema).optional(),
  model: botConfigSchema.shape.model.optional(),
  database: z.custom<Database>(),
  name: z.string().min(1, "Bot name is required"),
  platforms: botConfigSchema.shape.platforms,
  plugins: z
    .array(
      z.union([
        goodchatPluginDefinitionSchema,
        goodchatPluginFactorySchema,
        goodchatPluginSchema,
      ])
    )
    .optional(),
  prompt: z.string().min(1, "Bot prompt is required"),
  tools: z.record(z.string(), toolSchema).optional(),
  withDashboard: z.boolean().optional(),
  auth: authConfigSchema.optional(),
});

export type GoodchatOptionsInput = z.infer<typeof goodchatOptionsSchema>;

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

export const createGoodchat = (options: GoodchatOptionsInput) => {
  const initialize = async () => {
    const {
      name,
      prompt,
      platforms,
      id,
      database,
      corsOrigin,
      plugins = [],
      tools,
      hooks,
      mcp,
      model,
      withDashboard = true,
      isServerless = false,
      auth = {
        enabled: false,
        mode: "password",
        localChatPublic: false,
      },
    } = goodchatOptionsSchema.parse(options);
    databaseDialectSchema.parse(database.dialect);
    const coreDir = dirname(fileURLToPath(import.meta.url));
    const packagedWebBuildPath = join(coreDir, "web");
    const webBuildPath = packagedWebBuildPath;

    const botConfig: BotConfig = {
      id: id ?? deriveBotId(name),
      name,
      prompt,
      platforms,
      model,
    };

    const resolvedPlugins: GoodchatPlugin[] = plugins.map((p) => {
      const pluginDefinition = isPluginFactory(p) ? p() : p;
      if (!isPluginDefinition(pluginDefinition)) {
        return pluginDefinition;
      }
      const env = pluginDefinition.env
        ? validatePluginEnv(pluginDefinition.name, pluginDefinition.env)
        : ({} as never);
      if (pluginDefinition.paramsSchema) {
        if (pluginDefinition.params === undefined) {
          throw new Error(
            `Plugin "${pluginDefinition.name}" params are required. Check the plugin configuration values.`
          );
        }
        const params = validatePluginParams(
          pluginDefinition.name,
          pluginDefinition.paramsSchema,
          pluginDefinition.params
        );
        return {
          name: pluginDefinition.name,
          ...pluginDefinition.create(env, params),
        };
      }

      return {
        name: pluginDefinition.name,
        ...pluginDefinition.create(env, undefined),
      };
    });

    const extensions = mergePlugins(resolvedPlugins, { hooks, mcp, tools });

    const webhookEnv = {
      CRON_SECRET: process.env.CRON_SECRET,
      WEBHOOK_FORWARD_URL: process.env.WEBHOOK_FORWARD_URL,
    };

    const authRuntime = createAuthRuntime({
      authConfig: auth,
      database,
    });

    // Better Auth issues session cookies for persisted users, so shared-password
    // mode still needs one internal account to authenticate against.
    if (auth.enabled && authRuntime && auth.password) {
      await bootstrapSharedAccount({
        authRuntime,
        password: auth.password,
      });
    }

    const shouldProtectLocalChat = auth.enabled && !auth.localChatPublic;

    const chatRuntime = createChatRuntime(botConfig, database, extensions);
    await chatRuntime.gateway.initialize();

    const authOpenApi = authRuntime
      ? await getBetterAuthOpenApiDocumentation(authRuntime.auth)
      : null;

    const app = new Elysia().use(
      cors({
        origin: corsOrigin ?? sameOriginCors,
        methods: ["GET", "POST", "PATCH", "OPTIONS"],
      })
    );

    if (authOpenApi) {
      app.use(
        openapi({
          documentation: {
            components: authOpenApi.components,
            paths: authOpenApi.paths,
          },
        })
      );
    } else {
      app.use(openapi());
    }

    const publicApi = new Elysia();

    publicApi
      .use(
        webhookChatController({
          botConfig,
          chatRuntime,
          env: webhookEnv,
          isServerless,
        })
      )
      .get("/health", () => "OK");

    const protectedApi = new Elysia()
      .onBeforeHandle(requireSessionGuard(authRuntime))
      .use(botController(botConfig))
      .use(threadsController(database, botConfig.id));

    const localApi = new Elysia().use(
      localChatController({
        botConfig,
        responseHandler: chatRuntime.responseHandler,
      })
    );

    const api = new Elysia({ prefix: "/api" });

    if (authRuntime) {
      // Work around Elysia mount regression with Better Auth under prefixed apps.
      // Problem: `mount(auth.handler)` can return 404 for `/api/auth/*` routes.
      // Solution: register explicit auth methods under the `/api` group so GET
      // auth endpoints are not shadowed by the dashboard `GET /*` fallback.
      // Issue reference: https://github.com/elysiajs/elysia/issues/1806#issuecomment-4128414602
      const forwardAuth = ({ request }: { request: Request }) => {
        return authRuntime.auth.handler(request);
      };

      api
        .get("/auth/*", forwardAuth)
        .post("/auth/*", forwardAuth)
        .put("/auth/*", forwardAuth)
        .patch("/auth/*", forwardAuth)
        .delete("/auth/*", forwardAuth)
        .options("/auth/*", forwardAuth)
        .head("/auth/*", forwardAuth);
    }

    api.use(publicApi).use(protectedApi);

    if (botConfig.platforms.includes("local")) {
      if (shouldProtectLocalChat) {
        api.use(
          new Elysia()
            .onBeforeHandle(requireSessionGuard(authRuntime))
            .use(localApi)
        );
      } else {
        api.use(localApi);
      }
    }

    app.use(api);

    if (withDashboard && !isServerless) {
      try {
        const webIndexHtml = await readFile(join(webBuildPath, "index.html"));
        app.use(
          staticPlugin({
            assets: webBuildPath,
            prefix: "/",
            alwaysStatic: true,
            indexHTML: false,
          })
        );

        app.get("/*", ({ set }) => {
          set.headers["content-type"] = "text/html; charset=utf-8";
          return webIndexHtml;
        });
      } catch (error) {
        throw new Error("Dashboard build not found.", {
          cause: error,
        });
      }
    }

    return { app, api, chatRuntime };
  };

  let _ready: ReturnType<typeof initialize> | undefined;

  return {
    name: options.name,
    database: { dialect: options.database.dialect },
    auth: options.auth,
    get ready() {
      _ready ??= initialize();
      return _ready;
    },
  };
};

export type GoodchatApi = Awaited<
  ReturnType<typeof createGoodchat>["ready"]
>["api"];
