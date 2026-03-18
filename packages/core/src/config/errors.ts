import { TaggedError } from "better-result";

export class ConfigNotFoundError extends TaggedError("ConfigNotFoundError")<{
  message: string;
  configPath?: string;
  attemptedPaths?: string[];
  code: "CONFIG_NOT_FOUND";
}>() {
  constructor(
    message: string,
    options?: { configPath?: string; attemptedPaths?: string[] },
    cause?: unknown
  ) {
    super({
      message,
      configPath: options?.configPath,
      attemptedPaths: options?.attemptedPaths,
      code: "CONFIG_NOT_FOUND",
    });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class ConfigInvalidError extends TaggedError("ConfigInvalidError")<{
  message: string;
  details?: string[];
  configPath?: string;
  code: "CONFIG_INVALID";
}>() {
  constructor(
    message: string,
    details?: string[],
    configPath?: string,
    cause?: unknown
  ) {
    super({ message, details, configPath, code: "CONFIG_INVALID" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
