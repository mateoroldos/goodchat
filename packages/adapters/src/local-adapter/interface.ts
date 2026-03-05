import type { IncomingMessage } from "@goodchat/core/bot.types";
import type { Result } from "better-result";
import type { InvalidPayloadError } from "./errors";

export interface LocalAdapterService {
  parseWebhook(payload: unknown): Result<IncomingMessage, InvalidPayloadError>;
}
