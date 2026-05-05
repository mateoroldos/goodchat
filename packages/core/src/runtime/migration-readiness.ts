import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Bot } from "@goodchat/contracts/config/types";

const MIGRATION_READINESS_CACHE_TTL_MS = 60_000;
const migrationReadinessCache = new WeakMap<object, number>();

interface MigrationJournalEntry {
  idx: number;
  tag?: string;
  when?: number;
}

interface MigrationJournal {
  entries: MigrationJournalEntry[];
}

const readExpectedMigrationIds = async (
  cwd: string
): Promise<string[] | null> => {
  const journalPath = join(cwd, "drizzle/meta/_journal.json");
  try {
    const content = await readFile(journalPath, "utf8");
    const parsed = JSON.parse(content) as MigrationJournal;
    if (!Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed.entries.map((entry) =>
      String(entry.when ?? entry.tag ?? entry.idx)
    );
  } catch {
    return null;
  }
};

const readRowsFromResult = (value: unknown): unknown[] | null => {
  if (!value) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(value) && value.length > 0) {
    const [firstEntry] = value;
    return Array.isArray(firstEntry) ? firstEntry : value;
  }
  if (Array.isArray(record.rows)) {
    return record.rows as unknown[];
  }

  return [value];
};

const readIdsFromResult = (value: unknown): string[] | null => {
  const rows = readRowsFromResult(value);
  if (!rows) {
    return null;
  }

  const ids: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      return null;
    }
    const id = (row as Record<string, unknown>).id;
    if (id === undefined || id === null) {
      return null;
    }
    ids.push(String(id));
  }
  return ids;
};

const queryAppliedMigrationIds = async (
  database: Bot["database"]
): Promise<string[] | null> => {
  const sqlByDialect: Record<Bot["database"]["dialect"], string> = {
    sqlite:
      'SELECT created_at as id FROM "__drizzle_migrations" ORDER BY id ASC',
    postgres:
      'SELECT created_at as id FROM "__drizzle_migrations" ORDER BY id ASC',
    mysql:
      "SELECT created_at as id FROM `__drizzle_migrations` ORDER BY id ASC",
  };
  const query = sqlByDialect[database.dialect];

  const rawConnection = (database as { rawConnection?: unknown }).rawConnection;
  const rawConnectionWithQuery = rawConnection as {
    query?: (statement: string) => Promise<unknown> | unknown;
  };
  if (typeof rawConnectionWithQuery?.query === "function") {
    const result = await rawConnectionWithQuery.query(query);
    const statementResult = result as {
      all?: () => unknown;
      get?: () => unknown;
    };
    if (typeof statementResult.all === "function") {
      return readIdsFromResult(statementResult.all());
    }
    if (typeof statementResult.get === "function") {
      return readIdsFromResult(statementResult.get());
    }
    return readIdsFromResult(result);
  }

  const rawConnectionWithExecute = rawConnection as {
    execute?: (statement: string) => Promise<unknown>;
  };
  if (typeof rawConnectionWithExecute?.execute === "function") {
    const result = await rawConnectionWithExecute.execute(query);
    return readIdsFromResult(result);
  }

  const connection = (database as { connection?: unknown }).connection;
  const connectionWithExecute = connection as {
    execute?: (statement: string) => Promise<unknown>;
  };
  if (typeof connectionWithExecute?.execute === "function") {
    const result = await connectionWithExecute.execute(query);
    return readIdsFromResult(result);
  }

  return null;
};

const assertMigrationIdsMatch = (
  expectedMigrationIds: readonly string[],
  appliedMigrationIds: readonly string[] | null
): void => {
  const firstMismatchIndex = expectedMigrationIds.findIndex(
    (expectedId, index) => appliedMigrationIds?.[index] !== expectedId
  );
  if (
    appliedMigrationIds === null ||
    firstMismatchIndex !== -1 ||
    appliedMigrationIds.length !== expectedMigrationIds.length
  ) {
    const mismatchIndex =
      firstMismatchIndex === -1
        ? expectedMigrationIds.length
        : firstMismatchIndex;
    throw new Error(
      `drizzle migration history differs at position ${mismatchIndex + 1}: expected ${expectedMigrationIds[mismatchIndex] ?? "<none>"}, applied ${appliedMigrationIds?.[mismatchIndex] ?? "<none>"}.`
    );
  }
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
    const expectedMigrationIds = await readExpectedMigrationIds(
      input.cwd ?? process.cwd()
    );
    if (expectedMigrationIds !== null && expectedMigrationIds.length > 0) {
      const appliedMigrationIds = await queryAppliedMigrationIds(
        input.database
      );
      assertMigrationIdsMatch(expectedMigrationIds, appliedMigrationIds);
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
