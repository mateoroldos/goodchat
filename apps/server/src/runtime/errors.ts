import { TaggedError } from "better-result";

export class BotNotFoundError extends TaggedError("BotNotFoundError")<{
  message: string;
  code: "BOT_NOT_FOUND";
}>() {
  constructor(message: string) {
    super({ message, code: "BOT_NOT_FOUND" });
  }
}

export class ChatRuntimeInitializationError extends TaggedError(
  "ChatRuntimeInitializationError"
)<{
  message: string;
  code: "CHAT_RUNTIME_INITIALIZATION_FAILED";
  details?: string[];
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, code: "CHAT_RUNTIME_INITIALIZATION_FAILED", details });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
