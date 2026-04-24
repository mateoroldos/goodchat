import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Elysia } from "elysia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthApi, setupDashboard } from "./app-bootstrap";

// Strategy: use real temp files and real routing to verify dashboard fallback
// and API precedence together, with mocks only at external boundaries.
const createFixtureDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), "goodchat-dashboard-"));
  await writeFile(
    join(dir, "index.html"),
    "<html><body>dashboard</body></html>"
  );
  await writeFile(join(dir, "app.js"), "console.log('app')");
  return dir;
};

describe("dashboard routes", () => {
  const fixtureDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      fixtureDirs.map(async (dir) => rm(dir, { force: true, recursive: true }))
    );
    fixtureDirs.length = 0;
  });

  it("keeps api routes working", async () => {
    const webBuildPath = await createFixtureDir();
    fixtureDirs.push(webBuildPath);

    const authHandler = vi.fn((request: Request) => {
      const path = new URL(request.url).pathname;
      return Response.json(
        { ok: true, path },
        {
          headers: { "content-type": "application/json" },
        }
      );
    });

    const authRuntime: NonNullable<Parameters<typeof createAuthApi>[0]> = {
      auth: {
        handler: authHandler,
      } as unknown as NonNullable<Parameters<typeof createAuthApi>[0]>["auth"],
      closeBootstrapSignup: () => undefined,
    };

    const app = new Elysia();
    const api = new Elysia({ prefix: "/api" })
      .use(createAuthApi(authRuntime))
      .get("/health", () => "OK");

    app.use(api);
    setupDashboard({ app, dashboard: true, webBuildPath });

    const dashboardResponse = await app.handle(
      new Request("http://localhost/dashboard/settings")
    );
    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.headers.get("content-type")).toContain(
      "text/html"
    );
    await expect(dashboardResponse.text()).resolves.toContain("dashboard");

    const healthResponse = await app.handle(
      new Request("http://localhost/api/health")
    );
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.text()).resolves.toBe("OK");

    const authResponse = await app.handle(
      new Request("http://localhost/api/auth/get-session")
    );
    expect(authResponse.status).toBe(200);
    await expect(authResponse.json()).resolves.toEqual({
      ok: true,
      path: "/api/auth/get-session",
    });
    expect(authHandler).toHaveBeenCalledTimes(1);
  });

  it("serves static files", async () => {
    const webBuildPath = await createFixtureDir();
    fixtureDirs.push(webBuildPath);

    const app = new Elysia();
    setupDashboard({ app, dashboard: true, webBuildPath });

    const assetResponse = await app.handle(
      new Request("http://localhost/app.js")
    );
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain("javascript");
    await expect(assetResponse.text()).resolves.toContain("console.log('app')");
  });

  it("throws when index.html is missing from build output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "goodchat-dashboard-"));
    fixtureDirs.push(dir);

    expect(() =>
      setupDashboard({ app: new Elysia(), dashboard: true, webBuildPath: dir })
    ).toThrow("Dashboard build not found.");
  });
});
