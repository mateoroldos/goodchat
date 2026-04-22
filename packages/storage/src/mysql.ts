import type { Database } from "@goodchat/contracts/database/interface";
import type { AnyMySql2Connection } from "drizzle-orm/mysql2";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { createMysqlRepositories } from "./repositories-mysql";

export interface MysqlAdapterOptions {
  client?: AnyMySql2Connection;
  connectionString: string;
  debugLogs?: boolean;
  mode?: "default" | "planetscale";
  schema?: Record<string, unknown>;
}

export type MysqlDb = ReturnType<typeof drizzle>;
type MysqlTransaction = Parameters<Parameters<MysqlDb["transaction"]>[0]>[0];

export type MysqlDatabase = MysqlDb | MysqlTransaction;

/** Narrowed Database with a typed drizzle connection for MySQL. */
export type MysqlConnectionFlavor = "mysql2" | "mysql2-planetscale";

export type MysqlDatabaseInstance = Database<
  MysqlDb,
  "mysql",
  AnyMySql2Connection,
  MysqlConnectionFlavor
>;

type TransactionRunner = <T>(
  fn: (database: MysqlDatabaseInstance) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: MysqlDatabase,
  transactionRunner: TransactionRunner,
  connection: MysqlDb,
  rawConnection: AnyMySql2Connection | undefined,
  connectionFlavor: MysqlConnectionFlavor,
  schema: Record<string, unknown> | undefined
): MysqlDatabaseInstance => ({
  ...createMysqlRepositories(database),
  connection,
  connectionFlavor,
  dialect: "mysql",
  rawConnection,
  schema,
  transaction: transactionRunner,
});

export const mysql = (options: MysqlAdapterOptions): MysqlDatabaseInstance => {
  const client = options.client ?? createPool(options.connectionString);
  const connectionFlavor: MysqlConnectionFlavor =
    options.mode === "planetscale" ? "mysql2-planetscale" : "mysql2";
  const db = drizzle(client, {
    logger: options.debugLogs,
    mode: options.mode ?? "default",
  });
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(
        createDatabaseInterface(
          tx,
          transactionRunner,
          db,
          client,
          connectionFlavor,
          options.schema
        )
      )
    );
  return createDatabaseInterface(
    db,
    transactionRunner,
    db,
    client,
    connectionFlavor,
    options.schema
  );
};
