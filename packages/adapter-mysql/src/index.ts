import type { Database } from "@goodchat/contracts/database/interface";
import type { MysqlAdapterOptions } from "./drizzle/client";
import { createMysqlDatabase } from "./drizzle/client";

export const mysql = (options: MysqlAdapterOptions): Database => {
  return createMysqlDatabase(options);
};

export type { MysqlAdapterOptions } from "./drizzle/client";
