import { describe, expect, it } from "bun:test";
import { SCHEMA_VERSION } from "@goodchat/core/schema/sqlite";
import { createTestDatabase } from "../utils";

const SCHEMA_MISMATCH_PATTERN = /schema mismatch/i;
const META_TABLE_PATTERN = /goodchat_meta/i;

describe("ensureSchemaVersion", () => {
  it("resolves when schema version matches", async () => {
    const database = createTestDatabase({ schemaVersion: SCHEMA_VERSION });
    await expect(database.ensureSchemaVersion()).resolves.toBeUndefined();
  });

  it("throws when schema version mismatches", async () => {
    const database = createTestDatabase({ schemaVersion: "2026-02-10" });
    await expect(database.ensureSchemaVersion()).rejects.toThrow(
      SCHEMA_MISMATCH_PATTERN
    );
  });

  it("throws when metadata table is missing", async () => {
    const database = createTestDatabase({ includeMetaTable: false });
    await expect(database.ensureSchemaVersion()).rejects.toThrow(
      META_TABLE_PATTERN
    );
  });
});
