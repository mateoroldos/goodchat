import type { Logger } from "@goodchat/contracts/plugins/types";
import { initLogger } from "evlog";
import { useLogger } from "evlog/elysia";
import type { LoggerService } from "./interface";
import { NOOP_LOGGER } from "./noop";

export class NoopLoggerService implements LoggerService {
  get() {
    return NOOP_LOGGER;
  }
}

export class ElysiaLoggerService implements LoggerService {
  readonly #loggerFactory: () => Logger;

  constructor(
    service: string,
    loggerFactory: () => Logger = () => useLogger()
  ) {
    initLogger({
      env: { service },
      redact: true,
      sampling: {
        rates: {
          debug: 0,
          error: 100,
          info: 20,
          warn: 50,
        },
      },
    });
    this.#loggerFactory = loggerFactory;
  }

  get() {
    try {
      return this.#loggerFactory();
    } catch {
      return NOOP_LOGGER;
    }
  }
}
