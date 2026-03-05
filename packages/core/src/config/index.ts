import { Result } from "better-result";
import { botConfigSchema } from "../bot/schema";
import { ConfigInvalidError, ConfigNotFoundError } from "./errors";
import type { ConfigService } from "./interface";

export class FileConfigService implements ConfigService {
  async loadBotConfig(configPath = "goodchat.config.ts") {
    const configUrls = [
      new URL(configPath, `file://${process.cwd()}/`),
      new URL(`../../../../${configPath}`, import.meta.url),
    ];

    let lastError: unknown = null;

    for (const configUrl of configUrls) {
      try {
        const module = await import(configUrl.href);
        const parsed = botConfigSchema.safeParse(module.default);

        if (!parsed.success) {
          return Result.err(
            new ConfigInvalidError(
              "Bot config is invalid",
              parsed.error.issues.map((issue) => issue.message)
            )
          );
        }

        return Result.ok(parsed.data);
      } catch (error) {
        console.error(error);
        lastError = error;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : "Unknown error";
    return Result.err(
      new ConfigNotFoundError("Bot config not found", lastError ?? message)
    );
  }
}

export type { ConfigService } from "./interface";
