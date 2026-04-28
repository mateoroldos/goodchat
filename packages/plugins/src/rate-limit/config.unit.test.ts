import { describe, expect, it } from "vitest";
import { parseCooldown, parseRateLimitConfig, parseWindow } from "./config";
import { createRateLimitRepository } from "./repository/index";

const repository = createRateLimitRepository(undefined);

describe("rate-limit config parsing", () => {
  it("parses window strings", () => {
    expect(parseWindow("20/5m")).toMatchObject({
      count: 20,
      windowMs: 5 * 60 * 1000,
    });

    expect(parseWindow("60/h")).toMatchObject({
      count: 60,
      windowMs: 60 * 60 * 1000,
    });

    expect(parseWindow("500/30s")).toMatchObject({
      count: 500,
      windowMs: 30 * 1000,
    });
  });

  it("throws on invalid window strings", () => {
    expect(() => parseWindow("20/min")).toThrow();
    expect(() => parseWindow("-1/5m")).toThrow();
    expect(() => parseWindow("20/0m")).toThrow();
  });

  it("parses cooldown strings", () => {
    expect(parseCooldown("3/10m -> 15m")).toMatchObject({
      durationMs: 15 * 60 * 1000,
      threshold: 3,
      thresholdWindowMs: 10 * 60 * 1000,
    });
  });

  it("throws on invalid cooldown strings", () => {
    expect(() => parseCooldown("3/10m=>15m")).toThrow();
    expect(() => parseCooldown("0/10m -> 15m")).toThrow();
    expect(() => parseCooldown("3/10m -> 0m")).toThrow();
  });

  it("applies defaults and validates integer limits", () => {
    const parsed = parseRateLimitConfig({
      messagesPerThread: "20/5m",
      repository,
    });

    expect(parsed.mode).toBe("enforce");
    expect(parsed.message).toContain("Rate limit reached");
    expect(parsed.exemptUserIds).toEqual([]);

    expect(() =>
      parseRateLimitConfig({
        repository,
        tokensPerHour: -1,
      })
    ).toThrow();
  });
});
