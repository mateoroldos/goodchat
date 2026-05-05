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
      queryResult: { rows: [{ count: "2" }] },
      expectedStatement: 'SELECT COUNT(*) as count FROM "__drizzle_migrations"',
    },
    {
      dialect: "mysql" as const,
      queryResult: [[{ count: 2 }]],
      expectedStatement: "SELECT COUNT(*) as count FROM `__drizzle_migrations`",
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
      JSON.stringify({ entries: [{ idx: 0 }, { idx: 1 }] }),
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
        query: (
          statement: string
        ) => Promise<{ rows: Array<{ count: string }> }>;
      };
    };
    database.rawConnection = {
      query: vi.fn(async () => ({ rows: [{ count: "1" }] })),
    };

    await expect(
      verifyDatabaseMigrationReadiness({
        botId: "bot-id",
        cwd: workspace,
        database,
        isServerless: false,
        pluginNames: ["rate-limiter"],
      })
    ).rejects.toThrow("drizzle migration history is behind");
  });
});
