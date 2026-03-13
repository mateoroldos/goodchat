import { TaggedError } from "better-result";
import type { Platform } from "../config/models";

export class ChatAdapterInitializationError extends TaggedError(
  "ChatAdapterInitializationError"
)<{
  message: string;
  platform: Platform;
  code: "CHAT_ADAPTER_INIT_FAILED";
}>() {
  constructor(message: string, platform: Platform, cause?: unknown) {
    super({ message, platform, code: "CHAT_ADAPTER_INIT_FAILED" });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export class ChatGatewayInitializationError extends TaggedError(
  "ChatGatewayInitializationError"
)<{
  message: string;
  errors: ChatAdapterInitializationError[];
  code: "CHAT_GATEWAY_INIT_FAILED";
}>() {
  constructor(message: string, errors: ChatAdapterInitializationError[]) {
    super({ message, errors, code: "CHAT_GATEWAY_INIT_FAILED" });
  }
}
