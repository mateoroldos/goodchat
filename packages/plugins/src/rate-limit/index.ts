import type {
  GoodchatPlugin,
  GoodchatPluginDefinition,
} from "@goodchat/contracts/plugins/types";
import {
  type ParsedRateLimitConfig,
  parseRateLimitConfig,
  type RateLimitConfigInput,
} from "./config";
import { buildAfterHook } from "./hook/after";
import { buildBeforeHook } from "./hook/before";
import { createRateLimitRepository as _createRepo } from "./repository/index";
import { rateLimitSchema as _mysqlSchema } from "./schemas/mysql";
import { rateLimitSchema as _postgresSchema } from "./schemas/postgres";
import { rateLimitSchema as _sqliteSchema } from "./schemas/sqlite";

const buildRateLimitPlugin = (
  config: ParsedRateLimitConfig
): GoodchatPlugin => {
  return {
    hooks: {
      afterMessage: buildAfterHook({ config }),
      beforeMessage: buildBeforeHook({ config }),
    },
    name: "rate-limit",
  };
};

export const rateLimit = (
  input: RateLimitConfigInput
): GoodchatPluginDefinition => {
  return {
    create: (_env, _params, runtime) => {
      const config = parseRateLimitConfig({
        ...input,
        repository: input.repository ?? _createRepo(runtime.database),
      });
      return buildRateLimitPlugin(config);
    },
    name: "rate-limit",
    params: undefined,
    paramsSchema: undefined,
  } satisfies GoodchatPluginDefinition;
};

export const createRateLimitRepository = _createRepo;
export const rateLimitMysqlSchema = _mysqlSchema;
export const rateLimitPostgresSchema = _postgresSchema;
export const rateLimitSqliteSchema = _sqliteSchema;

export type { RateLimitConfigInput } from "./config";
export type { RateLimitEvent } from "./events";
export type { RateLimitRepository } from "./repository/types";
