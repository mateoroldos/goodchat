import { Database as BunSqliteDatabase } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { sqliteSchema } from "../../schema/sqlite";
import { createRepositories } from "../../src/repository";
import type { SqliteDatabase } from "../../src/sqlite";

const createDatabaseInterface = (
  database: SqliteDatabase,
  transactionRunner: Database["transaction"]
): Database => ({
  ...createRepositories(sqliteSchema, database),
  dialect: "sqlite",
  transaction: transactionRunner,
});

export const createTestDatabase = (): Database => {
  const client = new BunSqliteDatabase(":memory:");
  const database = drizzle(client, { schema: sqliteSchema });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  migrate(database, { migrationsFolder });

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
