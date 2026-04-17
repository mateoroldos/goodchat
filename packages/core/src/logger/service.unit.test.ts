import type { Logger } from "@goodchat/contracts/plugins/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOOP_LOGGER } from "./noop";
import { ElysiaLoggerService, NoopLoggerService } from "./service";

const initLoggerMock = vi.hoisted(() => vi.fn());
const createWideLoggerMock = vi.hoisted(() => vi.fn());
const simpleLogErrorMock = vi.hoisted(() => vi.fn());
const simpleLogInfoMock = vi.hoisted(() => vi.fn());
const simpleLogWarnMock = vi.hoisted(() => vi.fn());

vi.mock("evlog", () => ({
  createLogger: createWideLoggerMock,
  initLogger: initLoggerMock,
  log: {
    error: simpleLogErrorMock,
    info: simpleLogInfoMock,
    warn: simpleLogWarnMock,
  },
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

    expect(service.request()).toBe(NOOP_LOGGER);
    expect(service.wide()).toBe(NOOP_LOGGER);
  });
});

describe("ElysiaLoggerService", () => {
  beforeEach(() => {
    initLoggerMock.mockReset();
    createWideLoggerMock.mockReset();
    simpleLogErrorMock.mockReset();
    simpleLogInfoMock.mockReset();
    simpleLogWarnMock.mockReset();
  });

  it("initializes logger with service metadata", () => {
    const logger = createLogger();
    const resolver = vi.fn(() => logger);
    const service = new ElysiaLoggerService("bot-service", resolver);

    expect(service.request()).toBe(logger);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(initLoggerMock).toHaveBeenCalledTimes(1);
    expect(initLoggerMock).toHaveBeenCalledWith({
      env: { service: "bot-service" },
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
  });

  it("falls back to noop logger when request logger is unavailable", () => {
    const resolver = vi.fn(() => {
      throw new Error("missing request context");
    });
    const service = new ElysiaLoggerService("bot-service", resolver);

    expect(service.request()).toBe(NOOP_LOGGER);
  });

  it("creates wide loggers through service", () => {
    const logger = createLogger();
    createWideLoggerMock.mockReturnValue(logger);
    const service = new ElysiaLoggerService("bot-service");

    expect(service.wide({ operation: "job" })).toBe(logger);
    expect(createWideLoggerMock).toHaveBeenCalledWith({ operation: "job" });
  });

  it("forwards simple logging helpers", () => {
    const service = new ElysiaLoggerService("bot-service");

    service.event.info("test info", { ok: true });
    service.event.warn("test warn", { ok: false });
    service.event.error("test error", { code: "E_TEST" });

    expect(simpleLogInfoMock).toHaveBeenCalledWith("test info", { ok: true });
    expect(simpleLogWarnMock).toHaveBeenCalledWith("test warn", {
      ok: false,
    });
    expect(simpleLogErrorMock).toHaveBeenCalledWith("test error", {
      code: "E_TEST",
    });
  });
});
