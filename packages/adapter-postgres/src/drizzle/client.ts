import type { Database } from "@goodchat/contracts/database/interface";

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

export type PostgresDatabase = unknown;

export const createPostgresDatabase = (
  options: PostgresAdapterOptions
): Database => {
  throw new Error(`Not implemented: ${options.connectionString}`);
};
