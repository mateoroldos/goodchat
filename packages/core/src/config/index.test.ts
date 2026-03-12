import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FileConfigService } from "./index";

const createTempConfigFile = async (contents: string) => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-config-"));
  const configPath = join(tempDirectory, "goodchat.config.ts");
  await writeFile(configPath, contents, "utf8");
  return { configPath, tempDirectory };
};

describe("FileConfigService", () => {
  it("loads a valid config from an explicit path", async () => {
    const { configPath, tempDirectory } = await createTempConfigFile(
      "export default { name: 'Echo', prompt: 'Hi', platforms: ['local'] };"
    );
    const service = new FileConfigService();

    try {
      const result = await service.loadBotConfig(configPath);

      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        throw new Error(result.error.message);
      }

      expect(result.value).toEqual({
        name: "Echo",
        prompt: "Hi",
        platforms: ["local"],
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns a validation error for invalid configs", async () => {
    const { configPath, tempDirectory } = await createTempConfigFile(
      "export default { name: 'Echo', platforms: ['local'] };"
    );
    const service = new FileConfigService();

    try {
      const result = await service.loadBotConfig(configPath);

      expect(result.isErr()).toBe(true);
      if (result.isOk()) {
        throw new Error("Expected an error result");
      }

      expect(result.error.code).toBe("CONFIG_INVALID");
      if (result.error.code === "CONFIG_INVALID") {
        expect(result.error.details?.length).toBeGreaterThan(0);
      }
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns not found when no config file can be loaded", async () => {
    const service = new FileConfigService();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await service.loadBotConfig(
        `missing-config-${Date.now()}.ts`
      );

      expect(result.isErr()).toBe(true);
      if (result.isOk()) {
        throw new Error("Expected an error result");
      }

      expect(result.error.code).toBe("CONFIG_NOT_FOUND");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
