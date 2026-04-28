import type { HookContext } from "@goodchat/contracts/hooks/types";
import type { GoodchatPluginDefinition } from "@goodchat/contracts/plugins/types";
import { describe, expect, it, vi } from "vitest";
import { rateLimit } from "./index";
import { createRateLimitRepository } from "./repository/index";

const createPlugin = (definition: GoodchatPluginDefinition) => {
  return {
    name: definition.name,
    ...definition.create({} as never, undefined, {
      database: undefined as never,
    }),
  };
};

const createContext = (overrides?: Partial<HookContext>): HookContext => {
  return {
    adapterName: "web",
    botName: "Test Bot",
    log: {
      emit: () => null,
      error: () => undefined,
      getContext: () => ({}),
      info: () => undefined,
      set: () => undefined,
      warn: () => undefined,
    },
    platform: "web",
    text: "Hello",
    threadId: "thread-1",
    userId: "user-1",
    ...overrides,
  };
};

const createContextWithLogSpy = () => {
  const set = vi.fn();
  return {
    context: createContext({
      log: {
        emit: () => null,
        error: () => undefined,
        getContext: () => ({}),
        info: () => undefined,
        set,
        warn: () => undefined,
      },
    }),
    set,
  };
};

describe("rateLimit plugin", () => {
  it("parses configuration at plugin creation", () => {
    const definition = rateLimit({
      messagesPerThread: "bad-format",
      repository: createRateLimitRepository(undefined),
    });

    expect(() => createPlugin(definition)).toThrow();
  });

  it("returns a plugin with before and after hooks", () => {
    const definition = rateLimit({
      messagesPerThread: "20/5m",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    expect(plugin.name).toBe("rate-limit");
    expect(plugin.hooks?.beforeMessage).toBeTypeOf("function");
    expect(plugin.hooks?.afterMessage).toBeTypeOf("function");
  });

  it("denies on message limit in enforce mode", async () => {
    const definition = rateLimit({
      messagesPerThread: "1/1h",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    const first = await plugin.hooks?.beforeMessage?.(createContext());
    const second = await plugin.hooks?.beforeMessage?.(createContext());

    expect(first).toEqual({ action: "continue" });
    expect(second).toMatchObject({
      action: "deny",
      reason: "rate_limited",
    });
  });

  it("allows in monitor mode even when message limit is exceeded", async () => {
    const definition = rateLimit({
      messagesPerThread: "1/1h",
      mode: "monitor",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    await plugin.hooks?.beforeMessage?.(createContext());
    const second = await plugin.hooks?.beforeMessage?.(createContext());

    expect(second).toEqual({ action: "continue" });
  });

  it("emits deny events in monitor mode", async () => {
    const definition = rateLimit({
      messagesPerThread: "1/1h",
      mode: "monitor",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);
    const { context, set } = createContextWithLogSpy();

    await plugin.hooks?.beforeMessage?.(context);
    await plugin.hooks?.beforeMessage?.(context);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ event: "rate_limit.deny", mode: "monitor" })
    );
  });

  it("sets and enforces cooldown after repeated violations", async () => {
    const definition = rateLimit({
      cooldown: "2/10m -> 15m",
      messagesPerThread: "1/1h",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    await plugin.hooks?.beforeMessage?.(createContext());
    await plugin.hooks?.beforeMessage?.(createContext());
    await plugin.hooks?.beforeMessage?.(createContext());
    const cooldownDeny = await plugin.hooks?.beforeMessage?.(createContext());

    expect(cooldownDeny).toMatchObject({
      action: "deny",
      reason: "rate_limited",
    });
    expect(cooldownDeny).toHaveProperty("retryAfterMs");
  });

  it("releases per-thread lease in after hook", async () => {
    const definition = rateLimit({
      maxConcurrentPerThread: 1,
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    const first = await plugin.hooks?.beforeMessage?.(createContext());
    const second = await plugin.hooks?.beforeMessage?.(createContext());

    expect(first).toEqual({ action: "continue" });
    expect(second).toMatchObject({ action: "deny" });

    await plugin.hooks?.afterMessage?.(createContext(), { text: "ok" });

    const third = await plugin.hooks?.beforeMessage?.(createContext());
    expect(third).toEqual({ action: "continue" });
  });

  it("allows up to configured concurrent messages per thread", async () => {
    const definition = rateLimit({
      maxConcurrentPerThread: 2,
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    const first = await plugin.hooks?.beforeMessage?.(createContext());
    const second = await plugin.hooks?.beforeMessage?.(createContext());
    const third = await plugin.hooks?.beforeMessage?.(createContext());

    expect(first).toEqual({ action: "continue" });
    expect(second).toEqual({ action: "continue" });
    expect(third).toMatchObject({ action: "deny" });
  });

  it("denies when token usage exceeds tokensPerHour", async () => {
    const repository = createRateLimitRepository(undefined);
    const spy = vi
      .spyOn(repository, "getTokenUsageFromBuckets")
      .mockResolvedValue(1001);

    const definition = rateLimit({
      repository,
      tokensPerHour: 1000,
    });
    const plugin = createPlugin(definition);

    const result = await plugin.hooks?.beforeMessage?.(createContext());

    expect(result).toMatchObject({ action: "deny", reason: "rate_limited" });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
  });

  it("allows when token usage is one under the limit", async () => {
    const repository = createRateLimitRepository(undefined);
    vi.spyOn(repository, "getTokenUsageFromBuckets").mockResolvedValue(999);

    const definition = rateLimit({
      repository,
      tokensPerHour: 1000,
    });
    const plugin = createPlugin(definition);

    const result = await plugin.hooks?.beforeMessage?.(createContext());

    expect(result).toEqual({ action: "continue" });
  });

  it("denies when token usage is exactly at the limit", async () => {
    const repository = createRateLimitRepository(undefined);
    vi.spyOn(repository, "getTokenUsageFromBuckets").mockResolvedValue(1000);

    const definition = rateLimit({
      repository,
      tokensPerHour: 1000,
    });
    const plugin = createPlugin(definition);

    const result = await plugin.hooks?.beforeMessage?.(createContext());

    expect(result).toMatchObject({ action: "deny", reason: "rate_limited" });
  });

  it("denies when tokensPerDay is exceeded", async () => {
    const repository = createRateLimitRepository(undefined);
    vi.spyOn(repository, "getTokenUsageFromBuckets").mockResolvedValue(5001);

    const definition = rateLimit({
      repository,
      tokensPerDay: 5000,
    });
    const plugin = createPlugin(definition);

    const result = await plugin.hooks?.beforeMessage?.(createContext());

    expect(result).toMatchObject({ action: "deny", reason: "rate_limited" });
  });

  it("exempt users bypass all limits", async () => {
    const repository = createRateLimitRepository(undefined);
    vi.spyOn(repository, "getTokenUsageFromBuckets").mockResolvedValue(99_999);
    vi.spyOn(repository, "acquireLease").mockResolvedValue(false);

    const definition = rateLimit({
      exemptUserIds: ["exempt-1"],
      maxConcurrentPerThread: 1,
      messagesPerThread: "1/1h",
      repository,
      tokensPerHour: 1,
    });
    const plugin = createPlugin(definition);

    const result = await plugin.hooks?.beforeMessage?.(
      createContext({ userId: "exempt-1" })
    );

    expect(result).toEqual({ action: "continue" });
    expect(repository.acquireLease).not.toHaveBeenCalled();
    expect(repository.getTokenUsageFromBuckets).not.toHaveBeenCalled();
  });

  it("non-exempt users are still rate limited when exemptUserIds is set", async () => {
    const definition = rateLimit({
      exemptUserIds: ["exempt-1"],
      messagesPerThread: "1/1h",
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    await plugin.hooks?.beforeMessage?.(createContext({ userId: "user-2" }));
    const second = await plugin.hooks?.beforeMessage?.(
      createContext({ userId: "user-2" })
    );

    expect(second).toMatchObject({ action: "deny" });
  });

  it("concurrent requests respect maxConcurrentPerThread limit", async () => {
    const definition = rateLimit({
      maxConcurrentPerThread: 3,
      repository: createRateLimitRepository(undefined),
    });
    const plugin = createPlugin(definition);

    const results = await Promise.all([
      plugin.hooks?.beforeMessage?.(createContext()),
      plugin.hooks?.beforeMessage?.(createContext()),
      plugin.hooks?.beforeMessage?.(createContext()),
      plugin.hooks?.beforeMessage?.(createContext()),
      plugin.hooks?.beforeMessage?.(createContext()),
    ]);

    const allowed = results.filter((r) => r?.action === "continue");
    const denied = results.filter((r) => r?.action === "deny");

    expect(allowed).toHaveLength(3);
    expect(denied).toHaveLength(2);
  });

  it("applies in-memory cooldown state globally", async () => {
    const repository = createRateLimitRepository(undefined);
    const definition = rateLimit({
      cooldown: "1/10m -> 15m",
      messagesPerThread: "1/1h",
      repository,
    });
    const plugin = createPlugin(definition);

    await plugin.hooks?.beforeMessage?.(createContext());
    await plugin.hooks?.beforeMessage?.(createContext());
    const deniedForFirstUser = await plugin.hooks?.beforeMessage?.(
      createContext()
    );

    const deniedForSecondUser = await plugin.hooks?.beforeMessage?.(
      createContext({ threadId: "thread-2", userId: "user-2" })
    );

    expect(deniedForFirstUser).toMatchObject({
      action: "deny",
      reason: "rate_limited",
    });
    expect(deniedForSecondUser).toEqual({ action: "continue" });
  });

  it("builds repository from runtime database when omitted", async () => {
    const plugin = createPlugin(
      rateLimit({
        messagesPerThread: "1/1h",
      })
    );

    const first = await plugin.hooks?.beforeMessage?.(createContext());
    const second = await plugin.hooks?.beforeMessage?.(createContext());

    expect(first).toEqual({ action: "continue" });
    expect(second).toMatchObject({ action: "deny", reason: "rate_limited" });
  });
});
