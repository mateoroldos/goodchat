import {
  AUTH_SCHEMA_TABLES_BY_DIALECT,
  CORE_SCHEMA_TABLES,
} from "../../../contracts/src/schema/declarations";
import { createSqliteDeclarationTableMap } from "../../../storage/src/internal-schema/shared";

const coreTables = createSqliteDeclarationTableMap(CORE_SCHEMA_TABLES);
const authTables = createSqliteDeclarationTableMap(
  AUTH_SCHEMA_TABLES_BY_DIALECT.sqlite
);

// Drizzle-kit schema discovery is more reliable with top-level table exports.
export const aiRuns = coreTables.ai_runs;
export const aiRunToolCalls = coreTables.ai_run_tool_calls;
export const threads = coreTables.threads;
export const messages = coreTables.messages;

export const user = authTables.user;
export const session = authTables.session;
export const account = authTables.account;
export const verification = authTables.verification;

export const sqliteSchema = {
  aiRuns,
  aiRunToolCalls,
  threads,
  messages,
};

export const authSchema = {
  user,
  session,
  account,
  verification,
};
