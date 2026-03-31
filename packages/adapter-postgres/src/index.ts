import type { Database } from "@goodchat/contracts/database/interface";
import type { PostgresAdapterOptions } from "./client";
import { createPostgresDatabase } from "./client";

export const postgres = (options: PostgresAdapterOptions): Database => {
  return createPostgresDatabase(options);
};

export type { PostgresAdapterOptions } from "./client";
