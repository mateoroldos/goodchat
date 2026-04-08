import { describe, expect, it } from "vitest";
import { createGoodchat } from "./index";
import { createDatabaseStub } from "./test-utils/database-stub";

describe("createGoodchat", () => {
  it("rejects empty bot names", async () => {
    await expect(
      createGoodchat({
        name: "",
        prompt: "Be helpful",
        platforms: ["local"],
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      })
    ).rejects.toThrow("Bot name is required");
  });

  it("rejects plugins without a name", async () => {
    await expect(
      createGoodchat({
        name: "Valid",
        prompt: "Be helpful",
        platforms: ["local"],
        plugins: [{ name: "", tools: {} }],
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      })
    ).rejects.toThrow("Plugin name is required");
  });

  it("rejects auth enabled without password", async () => {
    await expect(
      createGoodchat({
        name: "Valid",
        prompt: "Be helpful",
        platforms: ["local"],
        auth: {
          enabled: true,
          mode: "password",
          localChatPublic: false,
        },
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      })
    ).rejects.toThrow("Auth password is required when auth is enabled");
  });
});
