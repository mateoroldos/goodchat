import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import type { Bot } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";
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

  app.use(evlog({ drain }));
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

export type LocalChatAccess = "public" | "protected";

export const createLocalChatApi = ({
  authRuntime,
  localApi,
  access,
}: {
  authRuntime: DashboardAuthRuntime | null;
  localApi: Elysia;
  access: LocalChatAccess;
}) => {
  if (access === "public") {
    return localApi;
  }

  return new Elysia()
    .onBeforeHandle(requireSessionGuard(authRuntime))
    .use(localApi);
};

export const setupDashboard = async ({
  app,
  isServerless,
  webBuildPath,
  withDashboard,
}: {
  app: Elysia;
  isServerless: boolean;
  webBuildPath: string;
  withDashboard: boolean;
}) => {
  if (!withDashboard || isServerless) {
    return;
  }

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
};
