import { describe, expect, it } from "vitest";
import { authSchema as mysqlAuthSchema } from "../schema/auth/mysql";
import { authSchema as postgresAuthSchema } from "../schema/auth/postgres";
import { authSchema as sqliteAuthSchema } from "../schema/auth/sqlite";
import { mysqlSchema } from "../schema/mysql";
import { postgresSchema } from "../schema/postgres";
import { sqliteSchema } from "../schema/sqlite";

describe("storage schema exports", () => {
  it("storage schema exports remain compatible after dsl source switch", () => {
    expect(Object.keys(sqliteSchema)).toEqual([
      "aiRuns",
      "aiRunToolCalls",
      "threads",
      "messages",
    ]);
    expect(Object.keys(postgresSchema)).toEqual([
      "aiRuns",
      "aiRunToolCalls",
      "threads",
      "messages",
    ]);
    expect(Object.keys(mysqlSchema)).toEqual([
      "aiRuns",
      "aiRunToolCalls",
      "threads",
      "messages",
    ]);
    expect(Object.keys(sqliteAuthSchema)).toEqual([
      "user",
      "session",
      "account",
      "verification",
    ]);
    expect(Object.keys(postgresAuthSchema)).toEqual([
      "user",
      "session",
      "account",
      "verification",
    ]);
    expect(Object.keys(mysqlAuthSchema)).toEqual([
      "user",
      "session",
      "account",
      "verification",
    ]);
  });
});
