import { describe, expect, it } from "vitest";
import { createGoodbot } from "./index";

describe("createGoodbot", () => {
  it("rejects empty bot names", async () => {
    await expect(
      createGoodbot({
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
      createGoodbot({
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
