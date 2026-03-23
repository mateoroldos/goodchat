import { Result } from "better-result";
import { ThreadLimitInvalidError as ThreadLimitInvalidErrorClass } from "./errors";
import type { MessageStoreService } from "./interface";
import type { MessageEntry } from "./models";

export class InMemoryMessageStoreService implements MessageStoreService {
  readonly #threads: MessageEntry[] = [];

  appendThread(entry: MessageEntry) {
    this.#threads.push(entry);
    return Result.ok(undefined);
  }

  listThreads(limit: number) {
    if (!Number.isFinite(limit) || limit < 0) {
      return Result.err(
        new ThreadLimitInvalidErrorClass(
          "Thread limit must be a non-negative number"
        )
      );
    }

    const safeLimit = Math.min(Math.trunc(limit), this.#threads.length);
    return Result.ok(this.#threads.slice(-safeLimit).reverse());
  }
}

export type { MessageStoreService } from "./interface";
