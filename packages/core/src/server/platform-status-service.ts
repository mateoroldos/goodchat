import type { Platform } from "@goodchat/contracts/config/types";
import {
  PLATFORM_METADATA,
  PLATFORM_REQUIRED_ENV_KEYS,
} from "@goodchat/contracts/platform/platform-metadata";

export interface PlatformStatusResult {
  configured: boolean;
  connected: boolean | null;
  missingVars: string[];
}

const hasValue = (value: string | undefined) => (value?.trim().length ?? 0) > 0;

const checkSlack = async (env: Record<string, string | undefined>) => {
  const res = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });
  const json = (await res.json()) as { ok: boolean };
  return json.ok === true;
};

const checkDiscord = async (env: Record<string, string | undefined>) => {
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  return res.ok;
};

const checkLinear = async (env: Record<string, string | undefined>) => {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: env.LINEAR_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "{ viewer { id } }" }),
  });
  const json = (await res.json()) as { errors?: unknown[] };
  return res.ok && !json.errors?.length;
};

const checkGithub = async (env: Record<string, string | undefined>) => {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "goodchat",
    },
  });
  return res.ok;
};

const CONNECTION_CHECKS: Partial<
  Record<
    Platform,
    (env: Record<string, string | undefined>) => Promise<boolean>
  >
> = {
  slack: checkSlack,
  discord: checkDiscord,
  linear: checkLinear,
  github: checkGithub,
};

export const getPlatformStatus = async (
  platform: Platform,
  env: Record<string, string | undefined>
): Promise<PlatformStatusResult> => {
  const missingVars = PLATFORM_REQUIRED_ENV_KEYS[platform].filter(
    (k) => !hasValue(env[k])
  );
  const configured = missingVars.length === 0;

  if (!(configured && PLATFORM_METADATA[platform].canVerifyConnection)) {
    return { configured, connected: null, missingVars };
  }

  const check = CONNECTION_CHECKS[platform];
  if (!check) {
    return { configured, connected: null, missingVars };
  }

  try {
    const connected = await check(env);
    return { configured, connected, missingVars };
  } catch {
    return { configured, connected: false, missingVars };
  }
};
