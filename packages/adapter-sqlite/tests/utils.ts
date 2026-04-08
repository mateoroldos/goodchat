import { Database as BunSqliteDatabase } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { sqliteSchema } from "@goodchat/templates/schema/sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { SqliteDatabase } from "../src/client";
import { createSqliteRepositories } from "../src/repository";

const createDatabaseInterface = (
  database: SqliteDatabase,
  transactionRunner: Database["transaction"]
): Database => {
  const repositories = createSqliteRepositories(database);
  return {
    ...repositories,
    dialect: "sqlite",
    transaction: transactionRunner,
  };
};

export const createTestDatabase = (): Database => {
  const client = new BunSqliteDatabase(":memory:");
  const database = drizzle(client, { schema: sqliteSchema });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  migrate(database, {
    migrationsFolder,
  });

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
