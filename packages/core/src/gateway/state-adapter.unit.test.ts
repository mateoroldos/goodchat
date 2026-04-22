import type { Database } from "@goodchat/contracts/database/interface";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoggerService } from "../logger/interface";
import type { ChatGatewayConfig } from "./interface";

const stateHandles = {
  memory: { kind: "memory" },
  mysql: { kind: "mysql" },
  postgres: { kind: "postgres" },
  redis: { kind: "redis" },
  sqlite: { kind: "sqlite" },
};

const createMemoryStateMock = vi.fn(() => stateHandles.memory);
const createRedisStateMock = vi.fn(() => stateHandles.redis);
const createPostgresStateMock = vi.fn(() => stateHandles.postgres);
const createMysqlStateMock = vi.fn(() => stateHandles.mysql);
const createSqliteStateMock = vi.fn(() => stateHandles.sqlite);

vi.mock("@chat-adapter/state-memory", () => ({
  createMemoryState: createMemoryStateMock,
}));

vi.mock("@chat-adapter/state-redis", () => ({
  createRedisState: createRedisStateMock,
}));

vi.mock("@chat-adapter/state-pg", () => ({
  createPostgresState: createPostgresStateMock,
}));

vi.mock("@goodchat/state-mysql", () => ({
  createMysqlState: createMysqlStateMock,
}));

vi.mock("@goodchat/state-sqlite", () => ({
  createSqliteState: createSqliteStateMock,
}));

const { createDatabaseStateAdapter, createStateAdapter } = await import(
  "./state-adapter"
);

const createLoggerStub = (): LoggerService =>
  ({
    event: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    request: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      set: vi.fn(),
      warn: vi.fn(),
    })),
  }) as unknown as LoggerService;

const createConfig = (
  state: ChatGatewayConfig["state"],
  dialect: Database["dialect"] = "sqlite"
): ChatGatewayConfig => ({
  database: { dialect } as Database,
  logger: createLoggerStub(),
  platforms: [],
  state,
  userName: "bot",
});

describe("createStateAdapter", () => {
  beforeEach(() => {
    createMemoryStateMock.mockReset();
    createMemoryStateMock.mockImplementation(() => stateHandles.memory);
    createRedisStateMock.mockReset();
    createRedisStateMock.mockImplementation(() => stateHandles.redis);
    createPostgresStateMock.mockReset();
    createPostgresStateMock.mockImplementation(() => stateHandles.postgres);
    createMysqlStateMock.mockReset();
    createMysqlStateMock.mockImplementation(() => stateHandles.mysql);
    createSqliteStateMock.mockReset();
    createSqliteStateMock.mockImplementation(() => stateHandles.sqlite);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses memory adapter when configured", () => {
    const state = createStateAdapter(createConfig({ adapter: "memory" }));

    expect(createMemoryStateMock).toHaveBeenCalledOnce();
    expect(createPostgresStateMock).not.toHaveBeenCalled();
    expect(state).toBe(stateHandles.memory);
  });

  it("uses redis adapter with explicit redisUrl", () => {
    const state = createStateAdapter(
      createConfig({ adapter: "redis", redisUrl: "redis://localhost:6379" })
    );

    expect(createRedisStateMock).toHaveBeenCalledWith({
      url: "redis://localhost:6379",
    });
    expect(state).toBe(stateHandles.redis);
  });

  it("falls back to memory when redis adapter initialization fails", () => {
    createRedisStateMock.mockImplementation(() => {
      throw new Error("redis init failed");
    });
    const config = createConfig({ adapter: "redis" });

    const state = createStateAdapter(config);

    expect(config.logger.event.warn).toHaveBeenCalledWith(
      "[gateway] Redis state adapter could not be initialized. Falling back to memory state.",
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(createMemoryStateMock).toHaveBeenCalledOnce();
    expect(state).toBe(stateHandles.memory);
  });
});

describe("createDatabaseStateAdapter", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses postgres adapter when dialect is postgres", () => {
    const state = createDatabaseStateAdapter(
      createConfig({ adapter: "database" }, "postgres")
    );

    expect(createPostgresStateMock).toHaveBeenCalledOnce();
    expect(state).toBe(stateHandles.postgres);
  });

  it("uses mysql adapter when dialect is mysql", () => {
    const state = createDatabaseStateAdapter(
      createConfig({ adapter: "database" }, "mysql")
    );

    expect(createMysqlStateMock).toHaveBeenCalledOnce();
    expect(state).toBe(stateHandles.mysql);
  });

  it("falls back to memory when sqlite path env is missing", () => {
    const config = createConfig({ adapter: "database" }, "sqlite");

    const state = createDatabaseStateAdapter(config);

    expect(config.logger.event.warn).toHaveBeenCalledWith(
      "[gateway] SQLite state adapter requires SQLITE_URL or DATABASE_URL. Falling back to memory state."
    );
    expect(createMemoryStateMock).toHaveBeenCalledOnce();
    expect(state).toBe(stateHandles.memory);
  });

  it("falls back to memory when sqlite runs outside Bun runtime", () => {
    vi.stubEnv("DATABASE_URL", "./goodchat.sqlite");
    const config = createConfig({ adapter: "database" }, "sqlite");

    const state = createDatabaseStateAdapter(config);

    expect(config.logger.event.warn).toHaveBeenCalledWith(
      "[gateway] SQLite state adapter requires Bun runtime. Falling back to memory state."
    );
    expect(createSqliteStateMock).not.toHaveBeenCalled();
    expect(state).toBe(stateHandles.memory);
  });

  it("uses sqlite adapter when Bun runtime and path are available", () => {
    vi.stubEnv("DATABASE_URL", "./goodchat.sqlite");
    vi.stubGlobal("Bun", {});

    const state = createDatabaseStateAdapter(
      createConfig({ adapter: "database" }, "sqlite")
    );

    expect(createSqliteStateMock).toHaveBeenCalledWith({
      path: "./goodchat.sqlite",
    });
    expect(state).toBe(stateHandles.sqlite);
  });

  it("falls back to memory when database adapter throws", () => {
    createPostgresStateMock.mockImplementation(() => {
      throw new Error("postgres init failed");
    });
    const config = createConfig({ adapter: "database" }, "postgres");

    const state = createDatabaseStateAdapter(config);

    expect(config.logger.event.warn).toHaveBeenCalledWith(
      "[gateway] Failed to initialize postgres state adapter. Falling back to memory state.",
      expect.any(Error)
    );
    expect(createMemoryStateMock).toHaveBeenCalledOnce();
    expect(state).toBe(stateHandles.memory);
  });
});
