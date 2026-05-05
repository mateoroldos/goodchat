import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Bot } from "@goodchat/contracts/config/types";

const MIGRATION_READINESS_CACHE_TTL_MS = 60_000;
const migrationReadinessCache = new WeakMap<object, number>();

interface MigrationJournalEntry {
  idx: number;
}

interface MigrationJournal {
  entries: MigrationJournalEntry[];
}

const readExpectedMigrationCount = async (
  cwd: string
): Promise<number | null> => {
  const journalPath = join(cwd, "drizzle/meta/_journal.json");
  try {
    const content = await readFile(journalPath, "utf8");
    const parsed = JSON.parse(content) as MigrationJournal;
    if (!Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed.entries.length;
  } catch {
    return null;
  }
};

const readCountFromResult = (value: unknown): number | null => {
  if (!value) {
    return null;
  }

  const record = value as Record<string, unknown>;
  let rows: unknown[] | null = null;
  if (Array.isArray(value) && value.length > 0) {
    const [firstEntry] = value;
    rows = Array.isArray(firstEntry) ? firstEntry : value;
  } else if (Array.isArray(record.rows)) {
    rows = record.rows as unknown[];
  }

  const row = rows?.[0] ?? value;
  if (!row || typeof row !== "object") {
    return null;
  }

  const countRaw = (row as Record<string, unknown>).count;
  if (typeof countRaw === "number") {
    return countRaw;
  }
  if (typeof countRaw === "string") {
    const parsed = Number.parseInt(countRaw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof countRaw === "bigint") {
    return Number(countRaw);
  }

  return null;
};

const queryAppliedMigrationCount = async (
  database: Bot["database"]
): Promise<number | null> => {
  const sqlByDialect: Record<Bot["database"]["dialect"], string> = {
    sqlite: 'SELECT COUNT(*) as count FROM "__drizzle_migrations"',
    postgres: 'SELECT COUNT(*) as count FROM "__drizzle_migrations"',
    mysql: "SELECT COUNT(*) as count FROM `__drizzle_migrations`",
  };
  const query = sqlByDialect[database.dialect];

  const rawConnection = (database as { rawConnection?: unknown }).rawConnection;
  const rawConnectionWithQuery = rawConnection as {
    query?: (statement: string) => Promise<unknown> | unknown;
  };
  if (typeof rawConnectionWithQuery?.query === "function") {
    const result = await rawConnectionWithQuery.query(query);
    const statementResult = result as {
      get?: () => unknown;
    };
    if (typeof statementResult.get === "function") {
      return readCountFromResult(statementResult.get());
    }
    return readCountFromResult(result);
  }

  const rawConnectionWithExecute = rawConnection as {
    execute?: (statement: string) => Promise<unknown>;
  };
  if (typeof rawConnectionWithExecute?.execute === "function") {
    const result = await rawConnectionWithExecute.execute(query);
    return readCountFromResult(result);
  }

  const connection = (database as { connection?: unknown }).connection;
  const connectionWithExecute = connection as {
    execute?: (statement: string) => Promise<unknown>;
  };
  if (typeof connectionWithExecute?.execute === "function") {
    const result = await connectionWithExecute.execute(query);
    return readCountFromResult(result);
  }

  return null;
};

export interface VerifyDatabaseMigrationReadinessInput {
  botId: string;
  cwd?: string;
  database: Bot["database"];
  isServerless?: boolean;
  now?: () => number;
  pluginNames: readonly string[];
}

export const verifyDatabaseMigrationReadiness = async (
  input: VerifyDatabaseMigrationReadinessInput
): Promise<void> => {
  const now = (input.now ?? Date.now)();
  const isCacheEnabled = input.isServerless === true;
  const cacheKey = input.database as object;
  const cachedAt = migrationReadinessCache.get(cacheKey);
  if (
    isCacheEnabled &&
    cachedAt !== undefined &&
    now - cachedAt <= MIGRATION_READINESS_CACHE_TTL_MS
  ) {
    return;
  }

  try {
    const expectedMigrationCount = await readExpectedMigrationCount(
      input.cwd ?? process.cwd()
    );
    if (expectedMigrationCount !== null && expectedMigrationCount > 0) {
      const appliedMigrationCount = await queryAppliedMigrationCount(
        input.database
      );
      if (
        appliedMigrationCount === null ||
        appliedMigrationCount < expectedMigrationCount
      ) {
        throw new Error(
          `drizzle migration history is behind (${appliedMigrationCount ?? 0}/${expectedMigrationCount} applied).`
        );
      }
    }

    await input.database.threads.list({
      botId: input.botId,
      limit: 1,
      sort: "desc",
    });
    if (isCacheEnabled) {
      migrationReadinessCache.set(cacheKey, now);
    }
  } catch (error) {
    if (isCacheEnabled) {
      migrationReadinessCache.delete(cacheKey);
    }
    const reason = error instanceof Error ? ` ${error.message}` : "";
    const pluginHint =
      input.pluginNames.length === 0
        ? ""
        : ` Plugins configured: ${input.pluginNames.join(", ")}. If you recently added/changed plugin schema, regenerate and apply migrations.`;
    throw new Error(
      `Database migration readiness check failed.${pluginHint} Run schema sync, generate, and apply migrations before startup (bun run db:schema:sync && bun run db:generate && bun run db:migrate).${reason}`
    );
  }
};
