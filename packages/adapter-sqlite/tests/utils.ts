import { Database as BunSqliteDatabase } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { SCHEMA_VERSION, sqliteSchema } from "@goodchat/core/schema/sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { SqliteDatabase } from "../src/client";
import { createSqliteRepositories } from "../src/repository";
import { ensureSchemaVersion, META_ROW_ID } from "../src/version-check";

const createDatabaseInterface = (
  database: SqliteDatabase,
  transactionRunner: Database["transaction"]
): Database => {
  const repositories = createSqliteRepositories(database);
  return {
    ...repositories,
    dialect: "sqlite",
    ensureSchemaVersion: () => ensureSchemaVersion(database),
    transaction: transactionRunner,
  };
};

export interface TestDatabaseOptions {
  includeMetaRow?: boolean;
  includeMetaTable?: boolean;
  schemaVersion?: string;
}

export const createTestDatabase = (
  options: TestDatabaseOptions = {}
): Database => {
  const client = new BunSqliteDatabase(":memory:");
  const database = drizzle(client, { schema: sqliteSchema });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  migrate(database, {
    migrationsFolder,
  });

  const includeMetaTable = options.includeMetaTable ?? true;
  if (!includeMetaTable) {
    client.exec("DROP TABLE goodchat_meta;");
  } else if (options.includeMetaRow ?? true) {
    const schemaVersion = options.schemaVersion ?? SCHEMA_VERSION;
    client.exec(
      `INSERT INTO goodchat_meta (id, schema_version) VALUES ('${META_ROW_ID}', '${schemaVersion}');`
    );
  }
  const transactionRunner: Database["transaction"] = <T>(
    fn: (database: Database) => Promise<T>
  ) => {
    client.exec("BEGIN");
    return fn(createDatabaseInterface(database, transactionRunner))
      .then((result) => {
        client.exec("COMMIT");
        return result;
      })
      .catch((error) => {
        client.exec("ROLLBACK");
        throw error;
      });
  };

  return createDatabaseInterface(database, transactionRunner);
};
