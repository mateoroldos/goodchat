import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test/create-test-app";

describe("POST /webhook/local", () => {
  it("returns a bot response and log id for valid payloads", async () => {
    const { app } = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/webhook/local", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          botName: "Echo",
          text: "Hello",
          userId: "user-1",
          threadId: "thread-1",
        }),
      })
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      text: string;
      logId: string;
    };

    expect(payload.text).toBe("Echo: Hello");
    expect(payload.logId.length).toBeGreaterThan(0);
  });

  it("rejects invalid payloads with a 400", async () => {
    const { app } = createTestApp();

    const response = await app.handle(
      new Request("http://localhost/webhook/local", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          botName: "",
          text: "",
          userId: "",
          threadId: "",
        }),
      })
    );

    expect(response.status).toBe(422);
  });
});
