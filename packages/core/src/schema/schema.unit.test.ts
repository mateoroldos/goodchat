import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  messages as mysqlMessages,
  goodchatMeta as mysqlMeta,
  mysqlSchema,
  threads as mysqlThreads,
  SCHEMA_VERSION as mysqlVersion,
} from "./mysql";
import {
  messages as postgresMessages,
  goodchatMeta as postgresMeta,
  postgresSchema,
  threads as postgresThreads,
  SCHEMA_VERSION as postgresVersion,
} from "./postgres";
import {
  messages as sqliteMessages,
  goodchatMeta as sqliteMeta,
  sqliteSchema,
  threads as sqliteThreads,
  SCHEMA_VERSION as sqliteVersion,
} from "./sqlite";

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

describe("database schema", () => {
  it("keeps schema versions aligned across dialects", () => {
    expect(postgresVersion).toBe(sqliteVersion);
    expect(postgresVersion).toBe(mysqlVersion);
    expect(postgresVersion.length).toBeGreaterThan(0);
  });

  it("exposes complete sqlite schema", () => {
    const threadColumns = getTableColumns(sqliteThreads);
    const messageColumns = getTableColumns(sqliteMessages);
    const metaColumns = getTableColumns(sqliteMeta);

    expect(Object.keys(threadColumns)).toEqual(
      expect.arrayContaining(THREAD_COLUMNS)
    );
    expect(Object.keys(messageColumns)).toEqual(
      expect.arrayContaining(MESSAGE_COLUMNS)
    );
    expect(Object.keys(metaColumns)).toEqual(
      expect.arrayContaining(META_COLUMNS)
    );

    expect(sqliteSchema.threads).toBe(sqliteThreads);
    expect(sqliteSchema.messages).toBe(sqliteMessages);
    expect(sqliteSchema.goodchatMeta).toBe(sqliteMeta);
  });

  it("exposes complete postgres schema", () => {
    const threadColumns = getTableColumns(postgresThreads);
    const messageColumns = getTableColumns(postgresMessages);
    const metaColumns = getTableColumns(postgresMeta);

    expect(Object.keys(threadColumns)).toEqual(
      expect.arrayContaining(THREAD_COLUMNS)
    );
    expect(Object.keys(messageColumns)).toEqual(
      expect.arrayContaining(MESSAGE_COLUMNS)
    );
    expect(Object.keys(metaColumns)).toEqual(
      expect.arrayContaining(META_COLUMNS)
    );

    expect(postgresSchema.threads).toBe(postgresThreads);
    expect(postgresSchema.messages).toBe(postgresMessages);
    expect(postgresSchema.goodchatMeta).toBe(postgresMeta);
  });

  it("exposes complete mysql schema", () => {
    const threadColumns = getTableColumns(mysqlThreads);
    const messageColumns = getTableColumns(mysqlMessages);
    const metaColumns = getTableColumns(mysqlMeta);

    expect(Object.keys(threadColumns)).toEqual(
      expect.arrayContaining(THREAD_COLUMNS)
    );
    expect(Object.keys(messageColumns)).toEqual(
      expect.arrayContaining(MESSAGE_COLUMNS)
    );
    expect(Object.keys(metaColumns)).toEqual(
      expect.arrayContaining(META_COLUMNS)
    );

    expect(mysqlSchema.threads).toBe(mysqlThreads);
    expect(mysqlSchema.messages).toBe(mysqlMessages);
    expect(mysqlSchema.goodchatMeta).toBe(mysqlMeta);
  });
});
