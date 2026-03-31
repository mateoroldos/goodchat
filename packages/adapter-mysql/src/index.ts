import type { Database } from "@goodchat/contracts/database/interface";
import type { MysqlAdapterOptions } from "./client";
import { createMysqlDatabase } from "./client";

export const mysql = (options: MysqlAdapterOptions): Database => {
  return createMysqlDatabase(options);
};

export type { MysqlAdapterOptions } from "./client";
