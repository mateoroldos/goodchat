import { existsSync } from "node:fs";
import { join } from "node:path";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import type { Bot } from "@goodchat/contracts/config/types";
import { Elysia, file } from "elysia";
import { evlog } from "evlog/elysia";
import type { DashboardAuthRuntime } from "../auth/better-auth";
import { requireSessionGuard } from "./auth-guard";

interface OpenApiAuthDocs {
  components?: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

export const setupRequestLogging = ({
  app,
  drain,
  loggingEnabled,
}: {
  app: Elysia;
  drain: Bot["logging"]["drain"];
  loggingEnabled: boolean;
}) => {
  if (!loggingEnabled) {
    return;
  }

  app.use(
    evlog({
      drain,
      keep: (context) => {
        const path = context.path ?? "";
        const status = context.status ?? 200;
        const duration = context.duration ?? 0;

        if (status >= 400 || duration >= 1500) {
          context.shouldKeep = true;
          return;
        }

        if (
          path.startsWith("/api/webhook") ||
          path.startsWith("/api/local") ||
          path.startsWith("/api/auth")
        ) {
          context.shouldKeep = true;
        }
      },
    })
  );
};

export const setupOpenApiDocumentation = ({
  app,
  authOpenApi,
}: {
  app: Elysia;
  authOpenApi: OpenApiAuthDocs | null;
}) => {
  if (!authOpenApi) {
    app.use(openapi());
    return;
  }

  app.use(
    openapi({
      documentation: {
        components: authOpenApi.components,
        paths: authOpenApi.paths,
      },
    })
  );
};

export const createAuthApi = (authRuntime: DashboardAuthRuntime | null) => {
  const authApi = new Elysia();

  if (!authRuntime) {
    return authApi;
  }

  const forwardAuth = ({ request }: { request: Request }) => {
    return authRuntime.auth.handler(request);
  };

  // Work around Elysia mount regression with Better Auth under prefixed apps.
  // Problem: `mount(auth.handler)` can return 404 for `/api/auth/*` routes.
  // Solution: register explicit auth methods under the `/api` group so GET
  // auth endpoints are not shadowed by the dashboard `GET /*` fallback.
  // Issue reference: https://github.com/elysiajs/elysia/issues/1806#issuecomment-4128414602
  authApi
    .get("/auth/*", forwardAuth)
    .post("/auth/*", forwardAuth)
    .put("/auth/*", forwardAuth)
    .patch("/auth/*", forwardAuth)
    .delete("/auth/*", forwardAuth)
    .options("/auth/*", forwardAuth)
    .head("/auth/*", forwardAuth);

  return authApi;
};

export type WebChatAccess = "public" | "protected";

export const createWebChatApi = ({
  authRuntime,
  webApi,
  access,
}: {
  authRuntime: DashboardAuthRuntime | null;
  webApi: Elysia;
  access: WebChatAccess;
}) => {
  if (access === "public") {
    return webApi;
  }

  return new Elysia()
    .onBeforeHandle(requireSessionGuard(authRuntime))
    .use(webApi);
};

export const setupDashboard = ({
  app,
  dashboard,
  webBuildPath,
}: {
  app: Elysia;
  dashboard: boolean;
  webBuildPath: string;
}) => {
  if (!dashboard) {
    return;
  }

  try {
    const indexHtmlPath = join(webBuildPath, "index.html");

    if (!existsSync(indexHtmlPath)) {
      throw new Error("index.html not found in build output.");
    }

    app
      .use(
        staticPlugin({
          assets: webBuildPath,
          prefix: "/",
          alwaysStatic: true,
        })
      )
      .get("/*", ({ path }) => {
        const requestedPath = `${webBuildPath}/${path}`;
        if (existsSync(requestedPath)) {
          return file(requestedPath);
        }
        return file(indexHtmlPath);
      });
  } catch (error) {
    throw new Error("Dashboard build not found.", { cause: error });
  }
};
