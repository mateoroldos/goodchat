import type { Result } from "better-result";
import type { ConfigInvalidError, ConfigNotFoundError } from "./errors";
import type { BotConfig } from "./models";

export interface ConfigService {
  loadBotConfigs(): Promise<
    Result<BotConfig[], ConfigInvalidError | ConfigNotFoundError>
  >;
}
