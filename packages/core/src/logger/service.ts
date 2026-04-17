import type { Logger } from "@goodchat/contracts/plugins/types";
import { createLogger, initLogger, log } from "evlog";
import { useLogger } from "evlog/elysia";
import type { LoggerService } from "./interface";
import { NOOP_LOGGER } from "./noop";

interface EventLogger {
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export class NoopLoggerService implements LoggerService {
  readonly event: EventLogger = {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined,
  };

  request() {
    return NOOP_LOGGER;
  }

  wide() {
    return NOOP_LOGGER;
  }
}

export class ElysiaLoggerService implements LoggerService {
  readonly #createLoggerFactory: (context: Record<string, unknown>) => Logger;
  readonly #loggerFactory: () => Logger;
  readonly event: EventLogger;

  constructor(
    service: string,
    loggerFactory: () => Logger = () => useLogger(),
    createLoggerFactory: (context: Record<string, unknown>) => Logger = (
      context
    ) => createLogger(context),
    eventLogger: EventLogger = log as unknown as EventLogger
  ) {
    initLogger({
      env: { service },
      redact: true,
      sampling: {
        rates: {
          debug: 100,
          error: 100,
          info: 100,
          warn: 100,
        },
      },
    });
    this.#loggerFactory = loggerFactory;
    this.#createLoggerFactory = createLoggerFactory;
    this.event = eventLogger;
  }

  request() {
    try {
      return this.#loggerFactory();
    } catch {
      return NOOP_LOGGER;
    }
  }

  wide(context: Record<string, unknown> = {}) {
    try {
      return this.#createLoggerFactory(context);
    } catch {
      return NOOP_LOGGER;
    }
  }
}
