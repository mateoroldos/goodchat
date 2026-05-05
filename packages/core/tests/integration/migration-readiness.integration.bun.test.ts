import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyDatabaseMigrationReadiness } from "../../src/runtime/migration-readiness";
import { createDatabaseStub } from "../../src/test-utils/database-stub";

describe("verifyDatabaseMigrationReadiness with Bun SQLite", () => {
  it("passes startup when bun sqlite migration history matches local migration journal", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "goodchat-readiness-"));
    await mkdir(join(workspace, "drizzle/meta"), { recursive: true });
    await writeFile(
      join(workspace, "drizzle/meta/_journal.json"),
      JSON.stringify({
        entries: [
          { idx: 0, when: 1 },
          { idx: 1, when: 2 },
        ],
      }),
      "utf8"
    );

    const sqlite = new Database(":memory:");
    sqlite.exec(
      'CREATE TABLE "__drizzle_migrations" (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC);'
    );
    sqlite.exec(
      'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ("first", 1), ("second", 2);'
    );

    const database = createDatabaseStub() as ReturnType<
      typeof createDatabaseStub
    > & { rawConnection?: Database };
    database.rawConnection = sqlite;

    await expect(
      verifyDatabaseMigrationReadiness({
        botId: "bot-id",
        cwd: workspace,
        database,
        isServerless: false,
        pluginNames: ["rate-limiter"],
      })
    ).resolves.toBeUndefined();

    sqlite.close();
  });
});
