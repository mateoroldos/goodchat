import type { GoodchatHooks } from "@goodchat/contracts/plugins/types";
import { emitRateLimitEvent } from "../events";
import { DEFAULT_LEASE_TTL_MS } from "./constants";
import { denyFromConfig } from "./deny";
import { getTokenRules, getWindowRules } from "./rules";
import type { BeforeContext, BuildHookInput } from "./types";

const maybeGetCooldownDeny = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date
) => {
  const cooldown = await config.repository.getCooldown({
    now,
    userId: context.userId,
  });
  if (!cooldown) {
    return null;
  }

  const retryAfterMs = Math.max(0, cooldown.getTime() - now.getTime());
  return denyFromConfig(
    context,
    config,
    {
      current: null,
      limit: null,
      retryAfterMs,
      rule: "cooldown",
    },
    retryAfterMs
  );
};

const maybeAcquireLease = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date
) => {
  if (typeof config.maxConcurrentPerThread !== "number") {
    return { leaseAcquired: false, result: null };
  }

  const canAcquire = await config.repository.acquireLease({
    limit: config.maxConcurrentPerThread,
    now,
    threadId: context.threadId,
    ttlMs: DEFAULT_LEASE_TTL_MS,
  });
  if (!canAcquire) {
    return {
      leaseAcquired: false,
      result: denyFromConfig(context, config, {
        current: 1,
        limit: config.maxConcurrentPerThread,
        rule: "maxConcurrentPerThread",
      }),
    };
  }

  return { leaseAcquired: true, result: null };
};

const maybeSetCooldown = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date
) => {
  if (!config.cooldown) {
    return;
  }

  const violations = await config.repository.countViolations({
    since: new Date(now.getTime() - config.cooldown.thresholdWindowMs),
    userId: context.userId,
  });

  if (violations >= config.cooldown.threshold) {
    await config.repository.setCooldown({
      expiresAt: new Date(now.getTime() + config.cooldown.durationMs),
      userId: context.userId,
    });
  }
};

const maybeReleaseLease = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  leaseAcquired: boolean
) => {
  if (!leaseAcquired) {
    return;
  }

  await config.repository.releaseLease({
    threadId: context.threadId,
  });
};

const recordViolationAndCleanup = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date,
  leaseAcquired: boolean,
  setCooldown: boolean
) => {
  await config.repository.storeViolation({
    now,
    userId: context.userId,
  });

  if (setCooldown) {
    await maybeSetCooldown(config, context, now);
  }

  await maybeReleaseLease(config, context, leaseAcquired);
};

const enforceWindowRules = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date,
  leaseAcquired: boolean
) => {
  const windowRules = getWindowRules(config, context);

  for (const rule of windowRules) {
    if (!rule.parsed) {
      continue;
    }

    const count = await config.repository.getWindowCountAndIncrement({
      key: rule.key,
      now,
      rule: rule.repositoryRule,
      windowMs: rule.parsed.windowMs,
    });

    if (count <= rule.parsed.count) {
      continue;
    }

    await recordViolationAndCleanup(config, context, now, leaseAcquired, true);
    return denyFromConfig(context, config, {
      current: count,
      limit: rule.parsed.count,
      rule: rule.repositoryRule,
    });
  }

  return null;
};

const enforceTokenRules = async (
  config: BuildHookInput["config"],
  context: BeforeContext,
  now: Date,
  leaseAcquired: boolean
) => {
  const tokenRules = getTokenRules(config);

  for (const tokenRule of tokenRules) {
    if (typeof tokenRule.limit !== "number") {
      continue;
    }

    const since = new Date(now.getTime() - tokenRule.windowMs);
    const usage = await config.repository.getTokenUsageFromBuckets({
      granularity: tokenRule.granularity,
      since,
      userId: context.userId,
    });

    if (usage < tokenRule.limit) {
      continue;
    }

    await recordViolationAndCleanup(config, context, now, leaseAcquired, false);
    return denyFromConfig(context, config, {
      current: usage,
      limit: tokenRule.limit,
      rule: tokenRule.rule,
    });
  }

  return null;
};

export const buildBeforeHook = ({
  config,
}: BuildHookInput): NonNullable<GoodchatHooks["beforeMessage"]> => {
  return async (context) => {
    const now = new Date();

    if (config.exemptUserIds.includes(context.userId)) {
      return { action: "continue" };
    }

    const cooldownDeny = await maybeGetCooldownDeny(config, context, now);
    if (cooldownDeny) {
      return cooldownDeny;
    }

    const lease = await maybeAcquireLease(config, context, now);
    if (lease.result) {
      return lease.result;
    }

    const windowDeny = await enforceWindowRules(
      config,
      context,
      now,
      lease.leaseAcquired
    );
    if (windowDeny) {
      return windowDeny;
    }

    const tokenDeny = await enforceTokenRules(
      config,
      context,
      now,
      lease.leaseAcquired
    );
    if (tokenDeny) {
      return tokenDeny;
    }

    emitRateLimitEvent(context.log, {
      current: null,
      event: "rate_limit.allow",
      limit: null,
      mode: config.mode,
      platform: context.platform,
      rule: null,
      threadId: context.threadId,
      userId: context.userId,
    });

    return { action: "continue" };
  };
};
