import { TaggedError } from "better-result";

export class ThreadLimitInvalidError extends TaggedError(
  "ThreadLimitInvalidError"
)<{
  message: string;
  code: "THREAD_LIMIT_INVALID";
}>() {
  constructor(message: string) {
    super({ message, code: "THREAD_LIMIT_INVALID" });
  }
}

export class ThreadStoreUnavailableError extends TaggedError(
  "ThreadStoreUnavailableError"
)<{
  message: string;
  code: "THREAD_STORE_UNAVAILABLE";
}>() {
  constructor(message: string, cause?: unknown) {
    super({ message, code: "THREAD_STORE_UNAVAILABLE" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
