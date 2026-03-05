import { Result } from "better-result";
import { BotInputInvalidError } from "./errors";
import type { BotService } from "./interface";
import { incomingMessageSchema } from "./schema";
import type { BotConfig, IncomingMessage } from "./types";

export const defineBot = (config: BotConfig): BotConfig => config;

export class DefaultBotService implements BotService {
  sendMessage(message: IncomingMessage, _bot: BotConfig) {
    const parsed = incomingMessageSchema.safeParse(message);

    if (!parsed.success) {
      return Result.err(
        new BotInputInvalidError(
          "Invalid bot message input",
          parsed.error.issues.map((issue) => issue.message)
        )
      );
    }

    return Result.ok({ text: `Echo: ${message.text}` });
  }
}

export type { BotService } from "./interface";
