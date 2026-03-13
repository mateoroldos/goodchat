import type { Ok, Result } from "better-result";
import type { LogLimitInvalidError } from "./errors";
import type { MessageEntry } from "./models";

export interface MessageStoreService {
  appendLog(entry: MessageEntry): Ok<undefined, never>;
  listLogs(limit: number): Result<MessageEntry[], LogLimitInvalidError>;
}
