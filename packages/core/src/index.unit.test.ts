import { describe, expect, it } from "vitest";
import { createGoodchat } from "./index";
import { createDatabaseStub } from "./test-utils/database-stub";

describe("createGoodchat", () => {
  process.env.OPENAI_API_KEY = "test-openai-key";

  it("rejects empty bot names", async () => {
    await expect(
      createGoodchat({
        name: "",
        prompt: "Be helpful",
        platforms: ["local"],
        model: { provider: "openai", modelId: "gpt-4.1-mini" },
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      }).ready
    ).rejects.toThrow("Bot name is required");
  });

  it("rejects plugins without a name", async () => {
    await expect(
      createGoodchat({
        name: "Valid",
        prompt: "Be helpful",
        platforms: ["local"],
        model: { provider: "openai", modelId: "gpt-4.1-mini" },
        plugins: [{ name: "", tools: {} }],
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      }).ready
    ).rejects.toThrow("Plugin name is required");
  });

  it("rejects auth enabled without password", async () => {
    await expect(
      createGoodchat({
        name: "Valid",
        prompt: "Be helpful",
        platforms: ["local"],
        model: { provider: "openai", modelId: "gpt-4.1-mini" },
        auth: {
          enabled: true,
          mode: "password",
          localChatPublic: false,
        },
        database: createDatabaseStub(),
        isServerless: true,
        withDashboard: false,
      }).ready
    ).rejects.toThrow("Auth password is required when auth is enabled");
  });
});
