import type { Result } from "better-result";
import type { BotInputInvalidError } from "./errors";
import type { BotConfig, BotResponse, IncomingMessage } from "./types";

export interface BotService {
  sendMessage(
    message: IncomingMessage,
    bot: BotConfig
  ): Result<BotResponse, BotInputInvalidError>;
}
