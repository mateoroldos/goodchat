import { botConfigSchema } from "@goodchat/contracts/config/models";
import type { BotConfigInput } from "@goodchat/contracts/config/types";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseStub } from "./test-utils/database-stub";

const SHARED_AUTH_EMAIL = "owner@goodchat.internal";

const isSharedAuthPrincipal = (session: unknown): boolean => {
  if (!session || typeof session !== "object") {
    return false;
  }

  const user = (session as { user?: unknown }).user;
  if (!user || typeof user !== "object") {
    return false;
  }

  const email = (user as { email?: unknown }).email;
  return email === SHARED_AUTH_EMAIL;
};

const createTestApp = async (overrides: Partial<BotConfigInput> = {}) => {
  process.env.OPENAI_API_KEY = "test-openai-key";

  const getSession = vi.fn(async () => null);
  const readFile = vi.fn(async () => Buffer.from("<html>dashboard</html>"));
  const authHandler = vi.fn((request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/auth/")) {
      return new Response(JSON.stringify({ ok: true, path: pathname }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ ok: false }), {
      status: 404,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  vi.doMock("./auth/better-auth", () => ({
    SHARED_AUTH_EMAIL,
    isSharedAuthPrincipal,
    getBetterAuthOpenApiDocumentation: vi.fn(async () => ({
      components: {},
      paths: {},
    })),
    createAuthRuntime: ({ config }: { config: { enabled: boolean } }) => {
      if (!config.enabled) {
        return null;
      }

      return {
        auth: {
          handler: authHandler,
          api: {
            getSession,
          },
        },
        closeBootstrapSignup: () => undefined,
      };
    },
  }));

  const bootstrapSharedAccount = vi.fn(async () => undefined);
  vi.doMock("./auth/bootstrap-shared-account", () => ({
    bootstrapSharedAccount,
  }));

  vi.doMock("node:fs/promises", async () => {
    const actual =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises"
      );
    return {
      ...actual,
      readFile,
    };
  });

  vi.doMock("@elysiajs/static", () => ({
    staticPlugin: vi.fn(() => new Elysia()),
  }));

  const { createGoodchat } = await import("./index");
  const defaultAuth: NonNullable<BotConfigInput["auth"]> = {
    enabled: true,
    mode: "password",
    password: "secret",
    localChatPublic: false,
  };

  const defaultOptions = botConfigSchema.parse({
    name: "Test Bot",
    prompt: "Be helpful",
    platforms: ["local"],
    model: { provider: "openai", modelId: "gpt-4.1-mini" },
    database: createDatabaseStub(),
    auth: defaultAuth,
    isServerless: false,
    dashboard: true,
  });

  const resolvedAuth: BotConfigInput["auth"] = {
    enabled: overrides.auth?.enabled ?? defaultAuth.enabled,
    mode: overrides.auth?.mode ?? defaultAuth.mode,
    localChatPublic:
      overrides.auth?.localChatPublic ?? defaultAuth.localChatPublic,
    password: overrides.auth?.password ?? defaultAuth.password,
  };

  const { ready } = createGoodchat({
    ...defaultOptions,
    ...overrides,
    auth: resolvedAuth,
  });
  const result = await ready;

  return {
    app: result.app,
    mocks: {
      authHandler,
      bootstrapSharedAccount,
      readFile,
    },
  };
};

describe("createGoodchat auth route integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("mounts Better Auth handler under /api/auth/*", async () => {
    const { app, mocks } = await createTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/auth/ping")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      path: "/api/auth/ping",
    });
    expect(mocks.authHandler).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrapSharedAccount).toHaveBeenCalledTimes(1);
  });

  it("proxies GET /api/auth/get-session through Better Auth", async () => {
    const { app, mocks } = await createTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/auth/get-session")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      path: "/api/auth/get-session",
    });
    expect(mocks.authHandler).toHaveBeenCalledTimes(1);
  });

  it("returns auth status when auth is disabled", async () => {
    const { app, mocks } = await createTestApp({
      auth: {
        enabled: false,
        mode: "password",
        localChatPublic: false,
      },
    });

    const response = await app.handle(
      new Request("http://localhost/api/auth-status")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      enabled: false,
    });
    expect(mocks.authHandler).toHaveBeenCalledTimes(0);
  });

  it("returns auth status when auth is enabled", async () => {
    const { app, mocks } = await createTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/auth-status")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      enabled: true,
    });
    expect(mocks.authHandler).toHaveBeenCalledTimes(0);
  });

  it("serves dashboard routes without overriding auth and api responses", async () => {
    const { app, mocks } = await createTestApp();

    const dashboardResponse = await app.handle(
      new Request("http://localhost/dashboard")
    );
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("content-type")).toContain(
      "text/html"
    );
    await expect(dashboardResponse.text()).resolves.toContain("dashboard");

    const authResponse = await app.handle(
      new Request("http://localhost/api/auth/get-session")
    );
    expect(authResponse.status).toBe(200);
    await expect(authResponse.json()).resolves.toEqual({
      ok: true,
      path: "/api/auth/get-session",
    });

    expect(mocks.readFile).toHaveBeenCalledTimes(1);
  });

  it("protects /api/bot without a valid session", async () => {
    const { app } = await createTestApp();

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized",
    });
  });

  it("keeps /api/bot public when auth is disabled", async () => {
    const { app, mocks } = await createTestApp({
      auth: {
        enabled: false,
        mode: "password",
        localChatPublic: false,
      },
    });

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      name: "Test Bot",
    });
    expect(mocks.bootstrapSharedAccount).toHaveBeenCalledTimes(0);
  });

  it("protects local chat when auth is enabled and localChatPublic is false", async () => {
    const { app } = await createTestApp({
      auth: {
        enabled: true,
        mode: "password",
        password: "secret",
        localChatPublic: false,
      },
    });

    const response = await app.handle(
      new Request("http://localhost/api/local/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized",
    });
  });

  it("keeps local chat public when localChatPublic is true", async () => {
    const { app } = await createTestApp({
      auth: {
        enabled: true,
        mode: "password",
        password: "secret",
        localChatPublic: true,
      },
    });

    const response = await app.handle(
      new Request("http://localhost/api/local/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Message is required",
    });
  });
});
