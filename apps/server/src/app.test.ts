import { describe, expect, it } from "vitest";
import { createTestApp } from "./test/create-test-app";

describe("server app", () => {
  it("responds to health checks", async () => {
    const { app } = createTestApp();

    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
  });

  it("lists available bots", async () => {
    const { app } = createTestApp([
      {
        id: "local-echo",
        name: "local-echo",
        prompt: "Echoes incoming messages for local testing.",
        platforms: ["local"],
      },
      {
        id: "support-echo",
        name: "support-echo",
        prompt: "Helps with support queries using a friendly tone.",
        platforms: ["local"],
      },
    ]);

    const response = await app.handle(new Request("http://localhost/bots"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "local-echo",
        name: "local-echo",
        platforms: ["local"],
      },
      {
        id: "support-echo",
        name: "support-echo",
        platforms: ["local"],
      },
    ]);
  });
});
