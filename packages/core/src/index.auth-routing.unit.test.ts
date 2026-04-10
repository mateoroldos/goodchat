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

const createTestApp = async () => {
  const getSession = vi.fn(async () => null);
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
    createAuthRuntime: ({
      authConfig,
    }: {
      authConfig: { enabled: boolean };
    }) => {
      if (!authConfig.enabled) {
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

  const { createGoodchat } = await import("./index");
  const { ready } = createGoodchat({
    name: "Test Bot",
    prompt: "Be helpful",
    platforms: ["local"],
    database: createDatabaseStub(),
    auth: {
      enabled: true,
      mode: "password",
      password: "secret",
      localChatPublic: false,
    },
    isServerless: true,
    withDashboard: false,
  });
  const result = await ready;

  return {
    app: result.app,
    mocks: {
      authHandler,
      bootstrapSharedAccount,
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

  it("protects /api/bot without a valid session", async () => {
    const { app } = await createTestApp();

    const response = await app.handle(new Request("http://localhost/api/bot/"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Unauthorized",
    });
  });
});
