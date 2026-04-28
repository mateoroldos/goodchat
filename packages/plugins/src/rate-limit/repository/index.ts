import {
  createDatabaseRateLimitRepository,
  hasDatabaseShape,
} from "./database";
import { createMemoryRateLimitRepository } from "./memory";
import type { RateLimitRepository } from "./types";

export const createRateLimitRepository = (db: unknown): RateLimitRepository => {
  if (hasDatabaseShape(db)) {
    return createDatabaseRateLimitRepository(db);
  }

  return createMemoryRateLimitRepository();
};

export type {
  LeaseInput,
  RateLimitRepository,
  RateLimitWindowRule,
  TokenUsageInput,
  ViolationInput,
  WindowInput,
} from "./types";
