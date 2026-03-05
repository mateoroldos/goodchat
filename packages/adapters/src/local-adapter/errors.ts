import { TaggedError } from "better-result";

export class InvalidPayloadError extends TaggedError("InvalidPayloadError")<{
  message: string;
  details?: string[];
  code: "INVALID_PAYLOAD";
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, details, code: "INVALID_PAYLOAD" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
