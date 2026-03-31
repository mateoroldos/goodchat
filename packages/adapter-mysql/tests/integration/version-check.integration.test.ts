import { SCHEMA_VERSION } from "@goodchat/core/schema";
import { describe, expect, it } from "vitest";
import type { TestDatabaseOptions } from "../utils";
import { createTestDatabase } from "../utils";

const SCHEMA_MISMATCH_PATTERN = /schema mismatch/i;
const META_TABLE_PATTERN = /goodchat_meta/i;

const connectionString = process.env.MYSQL_TEST_URL;
const describeMysql = connectionString ? describe : describe.skip;

const withDatabase = async <T>(
  options: TestDatabaseOptions,
  fn: (
    database: Awaited<ReturnType<typeof createTestDatabase>>["database"]
  ) => Promise<T> | T
) => {
  if (!connectionString) {
    throw new Error("MYSQL_TEST_URL is required.");
  }
  const { database, cleanup } = await createTestDatabase(
    connectionString,
    options
  );
  try {
    return await fn(database);
  } finally {
    await cleanup();
  }
};

describeMysql("ensureSchemaVersion", () => {
  it("resolves when schema version matches", async () => {
    await withDatabase({ schemaVersion: SCHEMA_VERSION }, (database) =>
      expect(database.ensureSchemaVersion()).resolves.toBeUndefined()
    );
  });

  it("throws when schema version mismatches", async () => {
    await withDatabase({ schemaVersion: "2026-02-10" }, (database) =>
      expect(database.ensureSchemaVersion()).rejects.toThrow(
        SCHEMA_MISMATCH_PATTERN
      )
    );
  });

  it("throws when metadata table is missing", async () => {
    await withDatabase({ includeMetaTable: false }, (database) =>
      expect(database.ensureSchemaVersion()).rejects.toThrow(META_TABLE_PATTERN)
    );
  });
});
