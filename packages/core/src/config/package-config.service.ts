import { Result } from "better-result";
import type { ConfigService } from "./config.service.interface";
import { ConfigInvalidError, ConfigNotFoundError } from "./errors";
import {
  type BotConfig,
  type RawBotConfig,
  rawBotConfigSchema,
} from "./models";

const slugifyBotId = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

type BotRegistryInput = Record<string, RawBotConfig>;

export class PackageConfigService implements ConfigService {
  private readonly botRegistry: BotRegistryInput;

  constructor(botRegistry: BotRegistryInput) {
    this.botRegistry = botRegistry;
  }

  loadBotConfigs() {
    const entries = Object.entries(this.botRegistry);

    if (entries.length === 0) {
      return Promise.resolve(
        Result.err(
          new ConfigNotFoundError("No bot configs exported from bot registry")
        )
      );
    }

    const resolvedBots: BotConfig[] = [];
    const ids = new Set<string>();

    for (const [exportName, config] of entries) {
      const parsed = rawBotConfigSchema.safeParse(config);
      if (!parsed.success) {
        return Promise.resolve(
          Result.err(
            new ConfigInvalidError(
              "Bot config is invalid",
              parsed.error.issues.map((issue) => issue.message),
              exportName
            )
          )
        );
      }

      const id = slugifyBotId(exportName);
      if (ids.has(id)) {
        return Promise.resolve(
          Result.err(
            new ConfigInvalidError(
              "Duplicate bot id",
              [`Duplicate bot id: ${id}`],
              exportName
            )
          )
        );
      }

      ids.add(id);
      resolvedBots.push({
        ...parsed.data,
        id,
        platforms: Array.from(new Set(parsed.data.platforms)),
      });
    }

    return Promise.resolve(Result.ok(resolvedBots));
  }
}
