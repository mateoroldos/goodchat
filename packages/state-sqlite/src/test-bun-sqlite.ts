type QueryMethod = "run" | "get" | "all";

type QueryHandler = (
  sql: string,
  method: QueryMethod,
  params: unknown[]
) => unknown;

interface RunResult {
  changes: number;
}

const DEFAULT_RUN_RESULT: RunResult = { changes: 0 };

let handler: QueryHandler = () => null;

const runCalls: Array<{ sql: string; params: unknown[] }> = [];
const prepareCalls: string[] = [];
let closeCalls = 0;

function asRunResult(value: unknown): RunResult {
  if (
    typeof value === "object" &&
    value !== null &&
    "changes" in value &&
    typeof (value as { changes?: unknown }).changes === "number"
  ) {
    return value as RunResult;
  }
  return DEFAULT_RUN_RESULT;
}

export class Database {
  run(sql: string): RunResult {
    runCalls.push({ sql, params: [] });
    const value = handler(sql, "run", []);
    return asRunResult(value);
  }

  prepare(sql: string): {
    run: (...params: unknown[]) => RunResult;
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  } {
    prepareCalls.push(sql);
    return {
      run: (...params: unknown[]) => {
        runCalls.push({ sql, params });
        const value = handler(sql, "run", params);
        return asRunResult(value);
      },
      get: (...params: unknown[]) => handler(sql, "get", params),
      all: (...params: unknown[]) => {
        const value = handler(sql, "all", params);
        return Array.isArray(value) ? value : [];
      },
    };
  }

  close(): void {
    closeCalls += 1;
  }
}

export function setSqliteMockHandler(next: QueryHandler): void {
  handler = next;
}

export function resetSqliteMock(): void {
  handler = () => null;
  runCalls.length = 0;
  prepareCalls.length = 0;
  closeCalls = 0;
}

export function getSqliteMockState(): {
  runCalls: Array<{ sql: string; params: unknown[] }>;
  prepareCalls: string[];
  closeCalls: number;
} {
  return {
    runCalls,
    prepareCalls,
    closeCalls,
  };
}
