import { readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Result } from "better-result";
import type { ConfigService } from "./config.service.interface";
import { ConfigInvalidError, ConfigNotFoundError } from "./errors";
import type { BotConfig } from "./models";
import { rawBotConfigSchema } from "./models";

export class FileConfigService implements ConfigService {
  async loadBotConfigs(configPath = "bots") {
    const configDirectories = isAbsolute(configPath)
      ? [configPath]
      : [
          join(process.cwd(), configPath),
          join(new URL("../../../../", import.meta.url).pathname, configPath),
        ];

    let lastError: unknown = null;

    for (const configDirectory of configDirectories) {
      try {
        const bots = await loadBotsFromDirectory(configDirectory);
        if (bots.length === 0) {
          lastError = new Error("No bot configs found");
          continue;
        }

        return Result.ok(bots);
      } catch (error) {
        if (error instanceof ConfigInvalidError) {
          return Result.err(error);
        }
        lastError = error;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : "Unknown error";
    return Result.err(
      new ConfigNotFoundError(
        "Bot config not found",
        {
          configPath,
          attemptedPaths: configDirectories,
        },
        lastError ?? message
      )
    );
  }
}

const loadBotsFromDirectory = async (baseDirectory: string) => {
  const entries = await readdir(baseDirectory, { withFileTypes: true });
  const botDirs = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const bots: BotConfig[] = [];

  for (const botDir of botDirs) {
    const botSlug = botDir.name;
    const configPath = join(baseDirectory, botSlug, "goodchat.config.ts");
    const configUrl = pathToFileURL(configPath);

    let module: { default?: unknown };

    try {
      module = await import(configUrl.href);
    } catch (error) {
      throw new ConfigInvalidError(
        "Bot config failed to load",
        [error instanceof Error ? error.message : "Unknown import error"],
        configPath,
        error
      );
    }

    const parsed = rawBotConfigSchema.safeParse(module.default);
    if (!parsed.success) {
      throw new ConfigInvalidError(
        "Bot config is invalid",
        parsed.error.issues.map((issue) => issue.message),
        configPath
      );
    }

    bots.push({
      ...parsed.data,
      id: botSlug,
      platforms: Array.from(new Set(parsed.data.platforms)),
    });
  }

  return bots;
};
