import { Result } from "better-result";
import { LogLimitInvalidError as LogLimitInvalidErrorClass } from "./errors";
import type { MessageStoreService } from "./message-store.service.interface";
import type { MessageEntry } from "./models";

export class InMemoryMessageStoreService implements MessageStoreService {
  readonly #logs: MessageEntry[] = [];

  appendLog(entry: MessageEntry) {
    this.#logs.push(entry);
    return Result.ok(undefined);
  }

  listLogs(limit: number) {
    if (!Number.isFinite(limit) || limit < 0) {
      return Result.err(
        new LogLimitInvalidErrorClass("Log limit must be a non-negative number")
      );
    }

    const safeLimit = Math.min(Math.trunc(limit), this.#logs.length);
    return Result.ok(this.#logs.slice(-safeLimit).reverse());
  }
}

export type { MessageStoreService } from "./message-store.service.interface";
