import { Result } from "better-result";
import { LogLimitInvalidError as LogLimitInvalidErrorClass } from "./errors";
import type { LogStoreService } from "./interface";
import type { LogEntry } from "./types";

export class InMemoryLogStoreService implements LogStoreService {
  readonly #logs: LogEntry[] = [];

  appendLog(entry: LogEntry) {
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

export type { LogStoreService } from "./interface";
