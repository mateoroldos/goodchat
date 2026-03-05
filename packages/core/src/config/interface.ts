import type { Result } from "better-result";
import type { BotConfig } from "../bot/types";
import type { ConfigInvalidError, ConfigNotFoundError } from "./errors";

export interface ConfigService {
  loadBotConfig(
    configPath?: string
  ): Promise<Result<BotConfig, ConfigInvalidError | ConfigNotFoundError>>;
}
