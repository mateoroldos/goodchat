import { postgresSchema, SCHEMA_VERSION } from "@goodchat/core/schema";
import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "./client";

export const META_ROW_ID = "primary";

const META_TABLE_NAME = "goodchat_meta";

const META_TABLE_PATTERN = /goodchat_meta/i;
const MISSING_TABLE_PATTERN = /does not exist/i;

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

const isMissingMetaTableError = (error: Error) =>
  META_TABLE_PATTERN.test(error.message) &&
  MISSING_TABLE_PATTERN.test(error.message);

export const ensureSchemaVersion = async (
  database: PostgresDatabase
): Promise<void> => {
  try {
    const rows = await database
      .select({ schemaVersion: postgresSchema.goodchatMeta.schemaVersion })
      .from(postgresSchema.goodchatMeta)
      .where(eq(postgresSchema.goodchatMeta.id, META_ROW_ID));
    const row = rows[0];

    if (!row) {
      throw buildMissingMetaRowError();
    }

    if (row.schemaVersion !== SCHEMA_VERSION) {
      throw buildSchemaMismatchError(row.schemaVersion);
    }
  } catch (error) {
    if (error instanceof Error && isMissingMetaTableError(error)) {
      throw buildMissingMetaTableError();
    }

    throw error;
  }
};
