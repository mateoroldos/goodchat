import type { Logger } from "@goodchat/contracts/plugins/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOOP_LOGGER } from "./noop";
import { ElysiaLoggerService, NoopLoggerService } from "./service";

const initLoggerMock = vi.hoisted(() => vi.fn());

vi.mock("evlog", () => ({
  initLogger: initLoggerMock,
}));

const createLogger = (): Logger => ({
  emit: vi.fn(),
  error: vi.fn(),
  getContext: vi.fn(() => ({})),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
});

describe("NoopLoggerService", () => {
  it("always returns noop logger", () => {
    const service = new NoopLoggerService();

    expect(service.get()).toBe(NOOP_LOGGER);
  });
});

describe("ElysiaLoggerService", () => {
  beforeEach(() => {
    initLoggerMock.mockReset();
  });

  it("initializes logger with service metadata", () => {
    const logger = createLogger();
    const resolver = vi.fn(() => logger);
    const service = new ElysiaLoggerService("bot-service", resolver);

    expect(service.get()).toBe(logger);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(initLoggerMock).toHaveBeenCalledTimes(1);
    expect(initLoggerMock).toHaveBeenCalledWith({
      env: { service: "bot-service" },
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
  });

  it("falls back to noop logger when request logger is unavailable", () => {
    const resolver = vi.fn(() => {
      throw new Error("missing request context");
    });
    const service = new ElysiaLoggerService("bot-service", resolver);

    expect(service.get()).toBe(NOOP_LOGGER);
  });
});
