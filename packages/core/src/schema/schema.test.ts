import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { defineSchema, SCHEMA_VERSION, type SchemaDialect } from "./schema";

const THREAD_COLUMNS = [
  "id",
  "botId",
  "botName",
  "platform",
  "adapterName",
  "threadId",
  "userId",
  "text",
  "responseText",
  "createdAt",
  "updatedAt",
  "lastActivityAt",
];

const MESSAGE_COLUMNS = [
  "id",
  "threadId",
  "role",
  "text",
  "createdAt",
  "metadata",
  "userId",
  "adapterName",
];

const META_COLUMNS = ["id", "schemaVersion"];

const DIALECTS: SchemaDialect[] = ["postgres", "sqlite", "mysql"];

describe("database schema", () => {
  it("exposes a schema version", () => {
    expect(SCHEMA_VERSION).toBeTypeOf("string");
    expect(SCHEMA_VERSION.length).toBeGreaterThan(0);
  });

  for (const dialect of DIALECTS) {
    it(`defines required tables for ${dialect}`, () => {
      const schema = defineSchema(dialect);
      const threadColumns = getTableColumns(schema.threads);
      const messageColumns = getTableColumns(schema.messages);
      const metaColumns = getTableColumns(schema.goodchatMeta);

      expect(Object.keys(threadColumns)).toEqual(
        expect.arrayContaining(THREAD_COLUMNS)
      );
      expect(Object.keys(messageColumns)).toEqual(
        expect.arrayContaining(MESSAGE_COLUMNS)
      );
      expect(Object.keys(metaColumns)).toEqual(
        expect.arrayContaining(META_COLUMNS)
      );

      expect(threadColumns.id.notNull).toBe(true);
      expect(threadColumns.createdAt.notNull).toBe(true);
      expect(threadColumns.updatedAt.notNull).toBe(true);
      expect(threadColumns.lastActivityAt.notNull).toBe(true);

      expect(messageColumns.role.notNull).toBe(false);
      expect(messageColumns.metadata.notNull).toBe(false);

      expect(metaColumns.schemaVersion.notNull).toBe(true);
    });
  }
});
