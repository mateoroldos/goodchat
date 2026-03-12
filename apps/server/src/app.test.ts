import { describe, expect, it } from "vitest";
import { createTestApp } from "./test/create-test-app";

describe("server app", () => {
  it("responds to health checks", async () => {
    const { app } = createTestApp();

    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
  });
});
