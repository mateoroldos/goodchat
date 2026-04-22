import type { Database } from "@goodchat/contracts/database/interface";
import { sql } from "@vercel/postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { Pool } from "pg";
import postgresJs from "postgres";
import { createPostgresRepositories } from "./repositories-postgres";

export type PostgresDriver =
  | "postgres-js"
  | "pg"
  | "@neondatabase/serverless"
  | "@vercel/postgres";

type PostgresJsClient = ReturnType<typeof postgresJs>;
type NodePgClient = Pool;

export type PostgresConnectionFlavor =
  | "postgres-js"
  | "pg"
  | "@neondatabase/serverless"
  | "@vercel/postgres";

interface BasePostgresAdapterOptions {
  connectionString: string;
  debugLogs?: boolean;
  schema?: Record<string, unknown>;
}

export type PostgresAdapterOptions =
  | (BasePostgresAdapterOptions & {
      driver?: "postgres-js";
      client?: PostgresJsClient;
    })
  | (BasePostgresAdapterOptions & { driver: "pg"; client?: NodePgClient })
  | (BasePostgresAdapterOptions & {
      driver: "@neondatabase/serverless";
    })
  | (BasePostgresAdapterOptions & {
      driver: "@vercel/postgres";
    });

type PostgresJsTransaction = Parameters<
  Parameters<ReturnType<typeof drizzlePostgresJs>["transaction"]>[0]
>[0];
type NodePgTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleNodePg>["transaction"]>[0]
>[0];
type NeonTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleNeon>["transaction"]>[0]
>[0];
type VercelTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleVercel>["transaction"]>[0]
>[0];

/** Top-level (non-transaction) drizzle connection types for Postgres. */
export type PostgresTopLevelDb =
  | ReturnType<typeof drizzlePostgresJs>
  | ReturnType<typeof drizzleNodePg>
  | ReturnType<typeof drizzleNeon>
  | ReturnType<typeof drizzleVercel>;

export type PostgresDatabase =
  | PostgresTopLevelDb
  | PostgresJsTransaction
  | NodePgTransaction
  | NeonTransaction
  | VercelTransaction;

/** Narrowed Database with a typed drizzle connection for Postgres. */
export type PostgresRawConnection = NodePgClient | PostgresJsClient;

export type PostgresDatabaseInstance = Database<
  PostgresTopLevelDb,
  "postgres",
  PostgresRawConnection,
  PostgresConnectionFlavor
>;

type TransactionRunner = <T>(
  fn: (database: PostgresDatabaseInstance) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: PostgresDatabase,
  transactionRunner: TransactionRunner,
  connection: PostgresTopLevelDb,
  rawConnection: PostgresRawConnection | undefined,
  connectionFlavor: PostgresConnectionFlavor,
  schema: Record<string, unknown> | undefined
): PostgresDatabaseInstance => ({
  ...createPostgresRepositories(database),
  connection,
  connectionFlavor,
  dialect: "postgres",
  rawConnection,
  schema,
  transaction: transactionRunner,
});

export const postgres = (
  options: PostgresAdapterOptions
): PostgresDatabaseInstance => {
  const { db, flavor, rawConnection } = createDriverDatabase(options);
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(
        createDatabaseInterface(
          tx,
          transactionRunner,
          db,
          rawConnection,
          flavor,
          options.schema
        )
      )
    );
  return createDatabaseInterface(
    db,
    transactionRunner,
    db,
    rawConnection,
    flavor,
    options.schema
  );
};

const createDriverDatabase = (
  options: PostgresAdapterOptions
): {
  db: PostgresTopLevelDb;
  flavor: PostgresConnectionFlavor;
  rawConnection: PostgresRawConnection | undefined;
} => {
  const config = { logger: options.debugLogs };

  if (options.driver === "pg") {
    const client =
      options.client ??
      new Pool({ connectionString: options.connectionString });
    return {
      db: drizzleNodePg(client, config),
      flavor: "pg",
      rawConnection: client,
    };
  }

  if (options.driver === "@neondatabase/serverless") {
    return {
      db: drizzleNeon(options.connectionString, config),
      flavor: "@neondatabase/serverless",
      rawConnection: undefined,
    };
  }

  if (options.driver === "@vercel/postgres") {
    return {
      db: drizzleVercel(sql, config),
      flavor: "@vercel/postgres",
      rawConnection: undefined,
    };
  }

  const client = options.client ?? postgresJs(options.connectionString);
  return {
    db: drizzlePostgresJs(client, config),
    flavor: "postgres-js",
    rawConnection: client,
  };
};
