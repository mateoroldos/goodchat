import type { RateLimitRepository, WindowInput } from "./types";

const trimExpiredTimestamps = (timestamps: Date[], since: Date): Date[] => {
  return timestamps.filter((value) => value >= since);
};

const keyForWindow = (
  input: Pick<WindowInput, "key" | "rule" | "windowMs">
) => {
  return `${input.rule}:${input.key}:${input.windowMs}`;
};

const userKey = (userId: string) => userId;
const threadKey = (threadId: string) => threadId;

export const createMemoryRateLimitRepository = (): RateLimitRepository => {
  const windows = new Map<string, Date[]>();
  const cooldownByUser = new Map<string, Date>();
  const violationsByUser = new Map<string, Date[]>();
  const leasesByThread = new Map<string, Date>();
  const leaseCountByThread = new Map<string, number>();

  return {
    acquireLease(input) {
      const key = threadKey(input.threadId);
      const currentExpiry = leasesByThread.get(key);

      if (currentExpiry && currentExpiry > input.now) {
        const current = leaseCountByThread.get(key) ?? 0;
        if (current >= input.limit) {
          return Promise.resolve(false);
        }

        leaseCountByThread.set(key, current + 1);
        return Promise.resolve(true);
      }

      leasesByThread.set(key, new Date(input.now.getTime() + input.ttlMs));
      leaseCountByThread.set(key, 1);
      return Promise.resolve(true);
    },

    countViolations(input) {
      const key = userKey(input.userId);
      const previous = violationsByUser.get(key) ?? [];
      const active = trimExpiredTimestamps(previous, input.since);
      violationsByUser.set(key, active);
      return Promise.resolve(active.length);
    },

    getTokenUsage() {
      return Promise.resolve(0);
    },

    getTokenUsageFromBuckets() {
      return Promise.resolve(0);
    },

    getWindowCount(input) {
      const key = keyForWindow(input);
      const previous = windows.get(key) ?? [];
      const since = new Date(input.now.getTime() - input.windowMs);
      const active = trimExpiredTimestamps(previous, since);
      windows.set(key, active);
      return Promise.resolve(active.length);
    },

    getWindowCountAndIncrement(input) {
      const key = keyForWindow(input);
      const previous = windows.get(key) ?? [];
      const since = new Date(input.now.getTime() - input.windowMs);
      const active = trimExpiredTimestamps(previous, since);
      active.push(input.now);
      windows.set(key, active);
      return Promise.resolve(active.length);
    },

    getCooldown(input) {
      const key = userKey(input.userId);
      const expiresAt = cooldownByUser.get(key);

      if (!expiresAt) {
        return Promise.resolve(null);
      }

      if (expiresAt <= input.now) {
        cooldownByUser.delete(key);
        return Promise.resolve(null);
      }

      return Promise.resolve(expiresAt);
    },

    releaseLease(input) {
      const key = threadKey(input.threadId);
      const current = leaseCountByThread.get(key) ?? 0;

      if (current <= 1) {
        leaseCountByThread.delete(key);
        leasesByThread.delete(key);
        return Promise.resolve();
      }

      leaseCountByThread.set(key, current - 1);
      return Promise.resolve();
    },

    setCooldown(input) {
      cooldownByUser.set(userKey(input.userId), input.expiresAt);
      return Promise.resolve();
    },

    storeViolation(input) {
      const key = userKey(input.userId);
      const previous = violationsByUser.get(key) ?? [];
      previous.push(input.now);
      violationsByUser.set(key, previous);
      return Promise.resolve();
    },
  };
};
