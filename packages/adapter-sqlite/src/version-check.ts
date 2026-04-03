import { SCHEMA_VERSION, sqliteSchema } from "@goodchat/core/schema";
import { eq } from "drizzle-orm";
import type { SqliteDatabase } from "./client";

export const META_ROW_ID = "primary";

const META_TABLE_NAME = "goodchat_meta";

const MISSING_TABLE_PATTERN = /no such table/i;

const buildSchemaMismatchError = (found: string) =>
  new Error(
    [
      "GoodchatError: Database schema mismatch.",
      `Expected: ${SCHEMA_VERSION}`,
      `Found: ${found}`,
      "Run: drizzle-kit push",
    ].join("\n")
  );

const buildMissingMetaRowError = () =>
  new Error(
    [
      "GoodchatError: Database schema mismatch.",
      `Expected metadata row in ${META_TABLE_NAME}.`,
      "Run: drizzle-kit push",
    ].join("\n")
  );

const buildMissingMetaTableError = () =>
  new Error(
    [
      "GoodchatError: Database schema mismatch.",
      `Missing table: ${META_TABLE_NAME}.`,
      "Run: drizzle-kit push",
    ].join("\n")
  );

export const ensureSchemaVersion = async (
  database: SqliteDatabase
): Promise<void> => {
  try {
    const row = await database
      .select()
      .from(sqliteSchema.goodchatMeta)
      .where(eq(sqliteSchema.goodchatMeta.id, META_ROW_ID))
      .get();

    if (!row) {
      throw buildMissingMetaRowError();
    }

    if (row.schemaVersion !== SCHEMA_VERSION) {
      throw buildSchemaMismatchError(row.schemaVersion);
    }
  } catch (error) {
    if (error instanceof Error && MISSING_TABLE_PATTERN.test(error.message)) {
      throw buildMissingMetaTableError();
    }

    throw error;
  }
};
