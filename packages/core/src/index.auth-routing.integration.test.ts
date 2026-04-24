import type { BotConfigInput } from "@goodchat/contracts/config/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseStub } from "./test-utils/database-stub";

const SHARED_AUTH_EMAIL = "owner@goodchat.internal";

const DEFAULT_AUTH: NonNullable<BotConfigInput["auth"]> = {
  enabled: true,
  mode: "password",
  password: "secret",
  webChatPublic: false,
};

const BASE_CONFIG: BotConfigInput = {
  name: "Test Bot",
  prompt: "Be helpful",
  platforms: ["web"],
  model: { provider: "openai", modelId: "gpt-4.1-mini" },
  database: createDatabaseStub(),
  auth: DEFAULT_AUTH,
  isServerless: false,
  dashboard: false,
};

const resolveAuth = (
  overrides: Partial<NonNullable<BotConfigInput["auth"]>> = {}
): NonNullable<BotConfigInput["auth"]> => ({
  ...DEFAULT_AUTH,
  ...overrides,
});

const createWebChatRequest = () =>
  new Request("http://localhost/api/web/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

interface MockOptions {
  isPrincipal?: boolean;
  session?: object | null;
}

const createTestApp = async (
  overrides: Partial<BotConfigInput> = {},
  { session = null, isPrincipal = false }: MockOptions = {}
) => {
  const getSession = vi.fn(async () => session);
  const authHandler = vi.fn((request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/auth/")) {
      return new Response(JSON.stringify({ ok: true, path: pathname }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });

  vi.doMock("./auth/better-auth", () => ({
    SHARED_AUTH_EMAIL,
    isSharedAuthPrincipal: vi.fn(() => isPrincipal),
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
          api: { getSession },
        },
        closeBootstrapSignup: () => undefined,
      };
    },
  }));

  const bootstrapSharedAccount = vi.fn(async () => undefined);
  vi.doMock("./auth/bootstrap-shared-account", () => ({
    bootstrapSharedAccount,
  }));

  const { createGoodchat } = await import("./index");

  const resolvedAuth = resolveAuth(overrides.auth ?? {});

  const { ready } = createGoodchat({
    ...BASE_CONFIG,
    ...overrides,
    auth: resolvedAuth,
  });
  const result = await ready;

  return {
    app: result.app,
    mocks: { authHandler, bootstrapSharedAccount },
  };
};

describe("createGoodchat auth routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      auth: { enabled: false, mode: "password", webChatPublic: false },
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

  it("protects /api/bot without a valid session", async () => {
    const { app } = await createTestApp();

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("grants /api/bot access with a valid session", async () => {
    const { app } = await createTestApp(
      {},
      { session: { user: { email: SHARED_AUTH_EMAIL } }, isPrincipal: true }
    );

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "Test Bot" });
  });

  it("keeps /api/bot public when auth is disabled", async () => {
    const { app, mocks } = await createTestApp({
      auth: { enabled: false, mode: "password", webChatPublic: false },
    });

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ name: "Test Bot" });
    expect(mocks.bootstrapSharedAccount).toHaveBeenCalledTimes(0);
  });

  it("protects web chat when auth is enabled and webChatPublic is false", async () => {
    const { app } = await createTestApp({
      auth: {
        enabled: true,
        mode: "password",
        password: "secret",
        webChatPublic: false,
      },
    });

    const response = await app.handle(createWebChatRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("keeps web chat public when webChatPublic is true", async () => {
    const { app } = await createTestApp({
      auth: {
        enabled: true,
        mode: "password",
        password: "secret",
        webChatPublic: true,
      },
    });

    const response = await app.handle(createWebChatRequest());

    expect(response.status).toBe(400);
  });
});
