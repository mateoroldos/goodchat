import type { Database } from "@goodchat/contracts/database/interface";
import { postgresSchema } from "@goodchat/core/schema";
import { neon } from "@neondatabase/serverless";
import { createPool as createVercelPool } from "@vercel/postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { Pool } from "pg";
import postgres from "postgres";
import { createPostgresRepositories } from "./repository";
import { ensureSchemaVersion } from "./version-check";

export type PostgresDriver =
  | "postgres-js"
  | "pg"
  | "@neondatabase/serverless"
  | "@vercel/postgres";

export interface PostgresAdapterOptions {
  client?: unknown;
  connectionString: string;
  debugLogs?: boolean;
  driver?: PostgresDriver;
}

export type PostgresDatabase =
  | ReturnType<typeof drizzlePostgresJs>
  | ReturnType<typeof drizzleNodePg>
  | ReturnType<typeof drizzleNeon>
  | ReturnType<typeof drizzleVercel>;

type TransactionRunner = <T>(
  fn: (database: Database) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: PostgresDatabase,
  transactionRunner: TransactionRunner
): Database => {
  const repositories = createPostgresRepositories(database);
  return {
    ...repositories,
    ensureSchemaVersion: () => ensureSchemaVersion(database),
    transaction: transactionRunner,
  };
};

export const createPostgresDatabase = (
  options: PostgresAdapterOptions
): Database => {
  const driver = options.driver ?? "postgres-js";
  const database = createDriverDatabase(driver, options);
  const transactionRunner: TransactionRunner = (fn) =>
    database.transaction((transaction) =>
      fn(createDatabaseInterface(transaction, transactionRunner))
    );

  return createDatabaseInterface(database, transactionRunner);
};

const createDriverDatabase = (
  driver: PostgresDriver,
  options: PostgresAdapterOptions
): PostgresDatabase => {
  const drizzleConfig = {
    logger: options.debugLogs,
    schema: postgresSchema,
  };

  if (driver === "pg") {
    const client =
      options.client ??
      new Pool({ connectionString: options.connectionString });
    return drizzleNodePg(client, drizzleConfig);
  }

  if (driver === "@neondatabase/serverless") {
    const client = options.client ?? neon(options.connectionString);
    return drizzleNeon(client, drizzleConfig);
  }

  if (driver === "@vercel/postgres") {
    const client =
      options.client ??
      createVercelPool({ connectionString: options.connectionString });
    return drizzleVercel(client, drizzleConfig);
  }

  const client = options.client ?? postgres(options.connectionString);
  return drizzlePostgresJs(client, drizzleConfig);
};
