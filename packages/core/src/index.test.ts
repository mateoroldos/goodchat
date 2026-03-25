import { describe, expect, it } from "vitest";
import { createGoodchat } from "./index";

describe("createGoodchat", () => {
  it("rejects empty bot names", async () => {
    await expect(
      createGoodchat({
        name: "",
        prompt: "Be helpful",
        platforms: ["local"],
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
        isServerless: true,
        withDashboard: false,
      })
    ).rejects.toThrow("Plugin name is required");
  });
});
