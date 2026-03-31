import type { Database } from "@goodchat/contracts/database/interface";
import type { MysqlDatabase } from "./client";

export const createMysqlRepositories = (
  database: MysqlDatabase
): Pick<Database, "messages" | "threads"> => {
  throw new Error(`Not implemented: ${String(database)}`);
};
