import { TaggedError } from "better-result";

export class LogLimitInvalidError extends TaggedError("LogLimitInvalidError")<{
  message: string;
  code: "LOG_LIMIT_INVALID";
}>() {
  constructor(message: string) {
    super({ message, code: "LOG_LIMIT_INVALID" });
  }
}

export class LogStoreUnavailableError extends TaggedError(
  "LogStoreUnavailableError"
)<{
  message: string;
  code: "LOG_STORE_UNAVAILABLE";
}>() {
  constructor(message: string, cause?: unknown) {
    super({ message, code: "LOG_STORE_UNAVAILABLE" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
