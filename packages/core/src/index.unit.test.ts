import type { BotConfigInput } from "@goodchat/contracts/config/types";
import { beforeEach, describe, expect, it } from "vitest";
import { createGoodchat } from "./index";
import { createDatabaseStub } from "./test-utils/database-stub";

describe("createGoodchat", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  const baseConfig: BotConfigInput = {
    id: "local-bot",
    name: "Local Bot",
    prompt: "Be helpful",
    platforms: ["local"],
    model: { provider: "openai" as const, modelId: "gpt-4.1-mini" },
    database: createDatabaseStub(),
    isServerless: true,
  };

  it("rejects empty bot names", async () => {
    await expect(
      createGoodchat({
        ...baseConfig,
        name: "",
      }).ready
    ).rejects.toThrow("Bot name is required");
  });

  it("rejects plugins without a name", async () => {
    await expect(
      createGoodchat({
        ...baseConfig,
        name: "Valid",
        plugins: [{ name: "", tools: {} }],
      }).ready
    ).rejects.toThrow("Plugin name is required");
  });

  it("rejects auth enabled without password", async () => {
    await expect(
      createGoodchat({
        ...baseConfig,
        name: "Valid",
        auth: {
          enabled: true,
          mode: "password",
          localChatPublic: false,
        },
      }).ready
    ).rejects.toThrow("Auth password is required when auth is enabled");
  });
});
