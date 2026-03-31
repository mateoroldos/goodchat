import type { Database } from "@goodchat/contracts/database/interface";

export interface MysqlAdapterOptions {
  connectionString: string;
  debugLogs?: boolean;
}

export type MysqlDatabase = unknown;

export const createMysqlDatabase = (options: MysqlAdapterOptions): Database => {
  throw new Error(`Not implemented: ${options.connectionString}`);
};
