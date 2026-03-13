import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileConfigService } from "./config.service";

const createTempBotConfig = async (
  slug: string,
  contents: string,
  baseDirectory: string
) => {
  const botDirectory = join(baseDirectory, "bots", slug);
  await mkdir(botDirectory, { recursive: true });
  const configPath = join(botDirectory, "goodchat.config.ts");
  await writeFile(configPath, contents, "utf8");
  return configPath;
};

describe("FileConfigService", () => {
  it("loads a valid config from an explicit path", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-config-"));
    await createTempBotConfig(
      "echo",
      "export default { name: 'Echo', prompt: 'Hi', platforms: ['local'] };",
      tempDirectory
    );
    const service = new FileConfigService();

    try {
      const result = await service.loadBotConfigs(join(tempDirectory, "bots"));

      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        throw new Error(result.error.message);
      }

      expect(result.value).toEqual([
        {
          id: "echo",
          name: "Echo",
          prompt: "Hi",
          platforms: ["local"],
        },
      ]);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns a validation error for invalid configs", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-config-"));
    await createTempBotConfig(
      "echo",
      "export default { name: 'Echo', platforms: ['local'] };",
      tempDirectory
    );
    const service = new FileConfigService();

    try {
      const result = await service.loadBotConfigs(join(tempDirectory, "bots"));

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

  it("loads multiple bots from a directory", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-config-"));
    await createTempBotConfig(
      "echo",
      "export default { name: 'Echo', prompt: 'Hi', platforms: ['local'] };",
      tempDirectory
    );
    await createTempBotConfig(
      "support",
      "export default { name: 'Support', prompt: 'Help', platforms: ['local'] };",
      tempDirectory
    );
    const service = new FileConfigService();

    try {
      const result = await service.loadBotConfigs(join(tempDirectory, "bots"));

      expect(result.isOk()).toBe(true);
      if (result.isErr()) {
        throw new Error(result.error.message);
      }

      expect(result.value).toEqual([
        {
          id: "echo",
          name: "Echo",
          prompt: "Hi",
          platforms: ["local"],
        },
        {
          id: "support",
          name: "Support",
          prompt: "Help",
          platforms: ["local"],
        },
      ]);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns not found when no config file can be loaded", async () => {
    const service = new FileConfigService();
    const result = await service.loadBotConfigs(
      join(tmpdir(), `missing-config-${Date.now()}`)
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected an error result");
    }

    expect(result.error.code).toBe("CONFIG_NOT_FOUND");
  });
});
