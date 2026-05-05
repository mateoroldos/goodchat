import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimiter } from "./rate-limiter";

const createLog = () => ({
  debug: vi.fn(),
  emit: vi.fn(),
  error: vi.fn(),
  getContext: vi.fn(() => ({})),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
});

const log = createLog();

const context = {
  adapterName: "slack",
  botId: "bot_1",
  botName: "Support Bot",
  log,
  platform: "slack",
  text: "hello",
  threadId: "thread_1",
  userId: "user_1",
} as const;

interface CounterRow {
  count: number;
  id: string;
  limitKey: string;
  subjectKey: string;
  subjectType: string;
  windowEnd: Date;
  windowStart: Date;
}

interface MemoryDb {
  core: Record<string, never>;
  delete: () => {
    where: (where: { windowEnd?: { lt?: Date } }) => {
      execute: () => Promise<number>;
    };
    execute: () => Promise<undefined>;
  };
  insert: () => {
    values: (payload: Partial<CounterRow>) => {
      execute: () => Promise<number>;
    };
  };
  query: {
    counters: {
      findFirst: (params: {
        where: Partial<CounterRow>;
      }) => Promise<CounterRow | undefined>;
      findMany: () => Promise<CounterRow[]>;
    };
  };
  rows: CounterRow[];
  tables: { counters: string };
  transaction: <Result>(
    callback: (tx: MemoryDb) => Promise<Result>
  ) => Promise<Result>;
  update: () => {
    set: (patch: Partial<CounterRow>) => {
      where: (where: Partial<CounterRow>) => { execute: () => Promise<void> };
      execute: () => Promise<undefined>;
    };
  };
}

const createMemoryDb = (rows: CounterRow[] = []): MemoryDb => {
  const db: MemoryDb = {
    core: {},
    rows,
    tables: { counters: "counters" },
    query: {
      counters: {
        findFirst: async ({ where }: { where: Partial<CounterRow> }) =>
          rows.find((row) =>
            Object.entries(where).every(
              ([key, value]) =>
                row[key as keyof CounterRow]?.valueOf() === value?.valueOf()
            )
          ),
        findMany: async () => rows,
      },
    },
    insert: () => ({
      values: (payload: Partial<CounterRow>) => ({
        execute: () => Promise.resolve(rows.push(payload as CounterRow)),
      }),
    }),
    delete: () => ({
      where: (where: { windowEnd?: { lt?: Date } }) => ({
        execute: () => {
          const before = rows.length;
          const lt = where.windowEnd?.lt;
          if (lt) {
            for (let index = rows.length - 1; index >= 0; index--) {
              const row = rows[index];
              if (row && row.windowEnd < lt) {
                rows.splice(index, 1);
              }
            }
          }
          return Promise.resolve(before - rows.length);
        },
      }),
      execute: () => Promise.resolve(undefined),
    }),
    update: () => ({
      set: (patch: Partial<CounterRow>) => ({
        where: (where: Partial<CounterRow>) => ({
          execute: () => {
            const row = rows.find((candidate) =>
              Object.entries(where).every(
                ([key, value]) =>
                  candidate[key as keyof CounterRow]?.valueOf() ===
                  value?.valueOf()
              )
            );
            if (row) {
              Object.assign(row, patch);
            }
            return Promise.resolve();
          },
        }),
        execute: () => Promise.resolve(undefined),
      }),
    }),
    transaction: async <Result>(callback: (tx: MemoryDb) => Promise<Result>) =>
      callback(db),
  };

  return db;
};

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1);
  });

  it("accepts valid config and declares counter schema", () => {
    const plugin = rateLimiter({
      limits: [{ by: "user", max: 100, metric: "messages", window: "1d" }],
    });

    expect(plugin.name).toBe("rate-limiter");
    expect(plugin.schema?.[0]?.tableName).toBe("counters");
    expect(plugin.schema?.[0]?.indexes).toContainEqual({
      name: "idx_counters_window_end",
      columns: ["window_end"],
    });
  });

  it("rejects invalid params", () => {
    expect(() => rateLimiter({ limits: [] })).toThrow(
      "At least one rate limit is required"
    );
    expect(() =>
      rateLimiter({
        limits: [{ by: "user", max: 0, metric: "messages", window: "1h" }],
      })
    ).toThrow();
    expect(() =>
      rateLimiter({
        limits: [{ by: "user", max: 1, metric: "messages", window: "1.5h" }],
      })
    ).toThrow();
    expect(() =>
      rateLimiter({ limits: [{ by: "user", max: 1, window: "1h" } as never] })
    ).toThrow();
    expect(() =>
      rateLimiter({
        limits: [
          { by: "user", max: 1, metric: "messages", window: "1h" },
          { by: "user", max: 1, metric: "messages", window: "60m" },
        ],
      })
    ).toThrow("Duplicate rate limit key");
  });

  it("creates and increments counters before blocking at the configured limit", async () => {
    vi.setSystemTime(new Date("2026-05-05T10:15:00.000Z"));
    const definition = rateLimiter({
      limits: [{ by: "user", max: 2, metric: "messages", window: "1h" }],
    });
    const plugin = definition.create({}, definition.params);
    const db = createMemoryDb();

    await plugin.hooks?.beforeMessage?.(context as never, db as never);
    await plugin.hooks?.beforeMessage?.(context as never, db as never);

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.count).toBe(2);
    await expect(
      plugin.hooks?.beforeMessage?.(context as never, db as never)
    ).rejects.toThrow("You've hit the rate limit. Please try again in 45m.");
  });

  it("allows messages again in the next fixed window", async () => {
    const definition = rateLimiter({
      limits: [{ by: "global", max: 1, metric: "messages", window: "1h" }],
    });
    const plugin = definition.create({}, definition.params);
    const db = createMemoryDb();

    vi.setSystemTime(new Date("2026-05-05T10:59:00.000Z"));
    await plugin.hooks?.beforeMessage?.(context as never, db as never);
    await expect(
      plugin.hooks?.beforeMessage?.(context as never, db as never)
    ).rejects.toThrow("1m");

    vi.setSystemTime(new Date("2026-05-05T11:00:00.000Z"));
    await plugin.hooks?.beforeMessage?.(context as never, db as never);

    expect(db.rows).toHaveLength(2);
  });

  it("adds structured log context and warns when a message is denied", async () => {
    vi.setSystemTime(new Date("2026-05-05T10:15:00.000Z"));
    const definition = rateLimiter({
      limits: [
        {
          by: "user",
          key: "per-user",
          max: 1,
          metric: "messages",
          window: "1h",
        },
      ],
    });
    const plugin = definition.create({}, definition.params);
    const db = createMemoryDb();

    await plugin.hooks?.beforeMessage?.(context as never, db as never);
    await expect(
      plugin.hooks?.beforeMessage?.(context as never, db as never)
    ).rejects.toThrow("45m");

    expect(log.set).toHaveBeenCalledWith({
      rateLimiter: expect.objectContaining({
        matchedRules: 1,
        status: "denied",
      }),
    });
    expect(log.warn).toHaveBeenCalledWith(
      "Rate limit denied message",
      expect.objectContaining({
        rateLimit: expect.objectContaining({
          limitKey: "per-user",
          retryAfter: "45m",
          subjectKey: "user_1",
        }),
      })
    );
  });
});
