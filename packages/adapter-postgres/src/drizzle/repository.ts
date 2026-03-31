import type { Database } from "@goodchat/contracts/database/interface";
import type { PostgresDatabase } from "./client";

export const createPostgresRepositories = (
  database: PostgresDatabase
): Pick<Database, "messages" | "threads"> => {
  throw new Error(`Not implemented: ${String(database)}`);
};
