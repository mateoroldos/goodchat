import { TaggedError } from "better-result";

export class ConfigNotFoundError extends TaggedError("ConfigNotFoundError")<{
  message: string;
  code: "CONFIG_NOT_FOUND";
}>() {
  constructor(message: string, cause?: unknown) {
    super({ message, code: "CONFIG_NOT_FOUND" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class ConfigInvalidError extends TaggedError("ConfigInvalidError")<{
  message: string;
  details?: string[];
  code: "CONFIG_INVALID";
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, details, code: "CONFIG_INVALID" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
