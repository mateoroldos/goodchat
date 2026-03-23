import { TaggedError } from "better-result";

export class ChatResponseInputInvalidError extends TaggedError(
  "ChatResponseInputInvalidError"
)<{
  message: string;
  details?: string[];
  code: "CHAT_RESPONSE_INPUT_INVALID";
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, details, code: "CHAT_RESPONSE_INPUT_INVALID" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class ChatResponseGenerationError extends TaggedError(
  "ChatResponseGenerationError"
)<{
  message: string;
  code: "CHAT_RESPONSE_GENERATION_FAILED";
  details?: string[];
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, code: "CHAT_RESPONSE_GENERATION_FAILED", details });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
