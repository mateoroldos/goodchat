import type { Ok, Result } from "better-result";
import type { ThreadLimitInvalidError } from "./errors";
import type { MessageEntry } from "./models";

export interface MessageStoreService {
  appendThread(entry: MessageEntry): Ok<undefined, never>;
  listThreads(limit: number): Result<MessageEntry[], ThreadLimitInvalidError>;
}
