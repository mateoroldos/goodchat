import { describe, expect, it } from "vitest";
import type { SqliteDatabase } from "./client";
import { ensureSchemaVersion } from "./version-check";

const SCHEMA_MISMATCH_PATTERN = /schema mismatch/i;
const META_TABLE_PATTERN = /goodchat_meta/i;

describe("ensureSchemaVersion", () => {
  it("resolves when schema version matches", async () => {
    const database: SqliteDatabase = {};
    await expect(ensureSchemaVersion(database)).resolves.toBeUndefined();
  });

  it("throws when schema version mismatches", async () => {
    const database: SqliteDatabase = {};
    await expect(ensureSchemaVersion(database)).rejects.toThrow(
      SCHEMA_MISMATCH_PATTERN
    );
  });

  it("throws when metadata table is missing", async () => {
    const database: SqliteDatabase = {};
    await expect(ensureSchemaVersion(database)).rejects.toThrow(
      META_TABLE_PATTERN
    );
  });
});
