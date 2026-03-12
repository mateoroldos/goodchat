import { TaggedError } from "better-result";

export class BotInputInvalidError extends TaggedError("BotInputInvalidError")<{
  message: string;
  details?: string[];
  code: "BOT_INPUT_INVALID";
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, details, code: "BOT_INPUT_INVALID" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class BotGenerationError extends TaggedError("BotGenerationError")<{
  message: string;
  code: "BOT_GENERATION_FAILED";
  details?: string[];
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, code: "BOT_GENERATION_FAILED", details });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
