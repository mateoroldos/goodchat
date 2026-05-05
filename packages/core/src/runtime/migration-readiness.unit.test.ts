import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDatabaseStub } from "../test-utils/database-stub";
import { verifyDatabaseMigrationReadiness } from "./migration-readiness";

describe("verifyDatabaseMigrationReadiness", () => {
  it("serverless startup caches successful migration readiness checks to reduce repeated cold-start probes", async () => {
    const database = createDatabaseStub();
    const listSpy = vi.fn(database.threads.list);
    database.threads.list = listSpy;

    await verifyDatabaseMigrationReadiness({
      botId: "bot-id",
      database,
      isServerless: true,
      pluginNames: [],
      cwd: "/definitely/missing",
      now: () => 1000,
    });

    await verifyDatabaseMigrationReadiness({
      botId: "bot-id",
      database,
      isServerless: true,
      pluginNames: [],
      cwd: "/definitely/missing",
      now: () => 1500,
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      dialect: "postgres" as const,
      queryResult: { rows: [{ id: "1000" }, { id: "2000" }] },
      expectedStatement:
        'SELECT created_at as id FROM "__drizzle_migrations" ORDER BY id ASC',
    },
    {
      dialect: "mysql" as const,
      queryResult: [[{ id: "1000" }, { id: "2000" }]],
      expectedStatement:
        "SELECT created_at as id FROM `__drizzle_migrations` ORDER BY id ASC",
    },
  ])("passes startup when $dialect migration history matches local migration journal", async ({
    dialect,
    expectedStatement,
    queryResult,
  }) => {
    const workspace = await mkdtemp(join(tmpdir(), "goodchat-readiness-"));
    await mkdir(join(workspace, "drizzle/meta"), { recursive: true });
    await writeFile(
      join(workspace, "drizzle/meta/_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 0, when: 1000 },
          { idx: 1, when: 2000 },
        ],
      }),
      "utf8"
    );

    const database = createDatabaseStub() as ReturnType<
      typeof createDatabaseStub
    > & {
      dialect: typeof dialect;
      rawConnection?: {
        query: (statement: string) => Promise<unknown>;
      };
    };
    database.dialect = dialect;
    database.rawConnection = {
      query: vi.fn(async () => queryResult),
    };

    await expect(
      verifyDatabaseMigrationReadiness({
        botId: "bot-id",
        cwd: workspace,
        database,
        isServerless: false,
        pluginNames: ["rate-limiter"],
      })
    ).resolves.toBeUndefined();

    expect(database.rawConnection.query).toHaveBeenCalledWith(
      expectedStatement
    );
  });

  it("fails startup when applied drizzle migration ids differ from local migration journal", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "goodchat-readiness-"));
    await mkdir(join(workspace, "drizzle/meta"), { recursive: true });
    await writeFile(
      join(workspace, "drizzle/meta/_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 0, when: 1000, tag: "0000_first" },
          { idx: 1, when: 2000, tag: "0001_second" },
        ],
      }),
      "utf8"
    );

    const database = createDatabaseStub() as ReturnType<
      typeof createDatabaseStub
    > & {
      rawConnection?: {
        query: (statement: string) => Promise<{ rows: Array<{ id: string }> }>;
      };
    };
    database.rawConnection = {
      query: vi.fn(async () => ({ rows: [{ id: "1000" }, { id: "3000" }] })),
    };

    await expect(
      verifyDatabaseMigrationReadiness({
        botId: "bot-id",
        cwd: workspace,
        database,
        isServerless: false,
        pluginNames: ["rate-limiter"],
      })
    ).rejects.toThrow(
      "drizzle migration history differs at position 2: expected 2000, applied 3000."
    );
  });

  it("fails startup when applied drizzle migrations are behind local migration journal", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "goodchat-readiness-"));
    await mkdir(join(workspace, "drizzle/meta"), { recursive: true });
    await writeFile(
      join(workspace, "drizzle/meta/_journal.json"),
      JSON.stringify({ entries: [{ idx: 0 }, { idx: 1 }] }),
      "utf8"
    );

    const database = createDatabaseStub() as ReturnType<
      typeof createDatabaseStub
    > & {
      rawConnection?: {
        query: (statement: string) => Promise<{ rows: Array<{ id: string }> }>;
      };
    };
    database.rawConnection = {
      query: vi.fn(async () => ({ rows: [{ id: "0" }] })),
    };

    await expect(
      verifyDatabaseMigrationReadiness({
        botId: "bot-id",
        cwd: workspace,
        database,
        isServerless: false,
        pluginNames: ["rate-limiter"],
      })
    ).rejects.toThrow(
      "drizzle migration history differs at position 2: expected 1, applied <none>."
    );
  });
});
