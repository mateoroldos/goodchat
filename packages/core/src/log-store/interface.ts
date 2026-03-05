import type { Ok, Result } from "better-result";
import type { LogLimitInvalidError } from "./errors";
import type { LogEntry } from "./types";

export interface LogStoreService {
  appendLog(entry: LogEntry): Ok<undefined, never>;
  listLogs(limit: number): Result<LogEntry[], LogLimitInvalidError>;
}
