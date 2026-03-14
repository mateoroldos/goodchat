import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileConfigService } from "./config.service";
import { watchBotConfigs } from "./config-watcher";

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

const waitFor = async (predicate: () => boolean, timeoutMs = 2000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for watcher update");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe("watchBotConfigs", () => {
  it("notifies on new bot directory", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-watch-"));
    const botsDir = join(tempDirectory, "bots");
    await createTempBotConfig(
      "echo",
      "export default { name: 'Echo', prompt: 'Hi', platforms: ['local'] };",
      tempDirectory
    );

    const service = new FileConfigService();
    const seenLengths: number[] = [];

    try {
      const watcherResult = await watchBotConfigs({
        configService: service,
        configPath: botsDir,
        onReload: (configs) => {
          seenLengths.push(configs.length);
        },
      });

      if (watcherResult.isErr()) {
        throw new Error(watcherResult.error.message);
      }

      await createTempBotConfig(
        "support",
        "export default { name: 'Support', prompt: 'Help', platforms: ['local'] };",
        tempDirectory
      );

      await waitFor(() => seenLengths.includes(2));
      watcherResult.value.stop();
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("returns an error when no bots directory exists", async () => {
    const service = new FileConfigService();
    const missingPath = join(tmpdir(), `missing-bots-${Date.now()}`);

    const result = await watchBotConfigs({
      configService: service,
      configPath: missingPath,
      onReload: () => undefined,
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected watcher to fail");
    }
    expect(result.error.code).toBe("CONFIG_WATCHER_FAILED");
  });
});
