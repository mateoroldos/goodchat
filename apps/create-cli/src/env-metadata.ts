import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
import { MODEL_PROVIDERS } from "@goodchat/contracts/model/model-ref";
import { PROVIDER_METADATA } from "@goodchat/contracts/model/provider-metadata";

export type Provider = ModelProvider;

export type EnvCategory = "core" | "platform" | "provider" | "plugin";

export interface EnvVariableMeta {
  category: EnvCategory;
  defaultValue?: string;
  description: string;
  docsUrl?: string;
  key: string;
  platforms?: string[];
  plugins?: string[];
  providers?: Provider[];
  requiresAuth?: boolean;
  schema?: string;
}

const ENV_METADATA: EnvVariableMeta[] = [
  ...MODEL_PROVIDERS.flatMap((provider): EnvVariableMeta[] => {
    return PROVIDER_METADATA[provider].envVariables.map((variable) => ({
      key: variable.key,
      description: variable.description,
      category: "provider",
      docsUrl: variable.docsUrl,
      schema: `z.string().min(1, "${variable.requiredMessage}")`,
      providers: [provider],
    }));
  }),
  {
    key: "DATABASE_URL",
    description:
      "Database connection URL (postgres/mysql) or sqlite file path (sqlite)",
    category: "core",
    schema: 'z.string().min(1, "DATABASE_URL is required")',
  },
  {
    key: "GOODCHAT_DASHBOARD_PASSWORD",
    description: "Password for dashboard auth",
    category: "core",
    requiresAuth: true,
    schema: 'z.string().min(1, "Dashboard password is required")',
  },
  {
    key: "GOODCHAT_AUTH_SECRET",
    description: "Secret key used to sign auth sessions",
    category: "core",
    requiresAuth: true,
    schema: 'z.string().min(1, "GOODCHAT_AUTH_SECRET is required")',
  },
  {
    key: "WEBHOOK_FORWARD_URL",
    description:
      "Optional URL to forward platform webhooks for internal request. In Railway set to http://localhost:8080",
    category: "core",
    schema: "z.string().url().optional()",
  },
  {
    key: "REDIS_URL",
    description: "Redis connection URL for state persistence",
    category: "core",
    schema: "z.string().url().optional()",
  },
  {
    key: "CRON_SECRET",
    description: "Secret used to authorize cron requests",
    category: "core",
    schema: "z.string().optional()",
  },
  {
    key: "SERVERLESS",
    description: "Set to true when running on serverless platforms",
    category: "core",
    schema: 'z.enum(["true", "false"]).optional()',
  },
  {
    key: "SLACK_BOT_TOKEN",
    description: "Slack bot token",
    category: "platform",
    docsUrl: "https://api.slack.com/apps",
    platforms: ["slack"],
  },
  {
    key: "SLACK_SIGNING_SECRET",
    description: "Slack signing secret",
    category: "platform",
    docsUrl: "https://api.slack.com/apps",
    platforms: ["slack"],
  },
  {
    key: "SLACK_CLIENT_ID",
    description: "Slack OAuth client id",
    category: "platform",
    docsUrl: "https://api.slack.com/apps",
    platforms: ["slack"],
  },
  {
    key: "SLACK_CLIENT_SECRET",
    description: "Slack OAuth client secret",
    category: "platform",
    docsUrl: "https://api.slack.com/apps",
    platforms: ["slack"],
  },
  {
    key: "SLACK_ENCRYPTION_KEY",
    description: "Slack token encryption key",
    category: "platform",
    docsUrl: "https://api.slack.com/apps",
    platforms: ["slack"],
  },
  {
    key: "DISCORD_BOT_TOKEN",
    description: "Discord bot token",
    category: "platform",
    docsUrl: "https://discord.com/developers/applications",
    platforms: ["discord"],
  },
  {
    key: "DISCORD_PUBLIC_KEY",
    description: "Discord interaction public key",
    category: "platform",
    docsUrl: "https://discord.com/developers/applications",
    platforms: ["discord"],
  },
  {
    key: "DISCORD_APPLICATION_ID",
    description: "Discord application id",
    category: "platform",
    docsUrl: "https://discord.com/developers/applications",
    platforms: ["discord"],
  },
  {
    key: "DISCORD_MENTION_ROLE_IDS",
    description: "Comma-separated role ids to treat as mention triggers",
    category: "platform",
    docsUrl: "https://discord.com/developers/applications",
    platforms: ["discord"],
  },
  {
    key: "TEAMS_APP_ID",
    description: "Microsoft Teams app id",
    category: "platform",
    docsUrl:
      "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps",
    platforms: ["teams"],
  },
  {
    key: "TEAMS_APP_PASSWORD",
    description: "Microsoft Teams app password",
    category: "platform",
    docsUrl:
      "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps",
    platforms: ["teams"],
  },
  {
    key: "TEAMS_APP_TENANT_ID",
    description: "Microsoft Teams tenant id",
    category: "platform",
    docsUrl:
      "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/Properties",
    platforms: ["teams"],
  },
  {
    key: "GOOGLE_CHAT_CREDENTIALS",
    description: "Google Chat service account credentials JSON",
    category: "platform",
    docsUrl: "https://developers.google.com/workspace/chat",
    platforms: ["gchat"],
  },
  {
    key: "GOOGLE_CHAT_USE_ADC",
    description: "Set true to use Application Default Credentials",
    category: "platform",
    docsUrl: "https://cloud.google.com/docs/authentication/production",
    platforms: ["gchat"],
  },
  {
    key: "GOOGLE_CHAT_PUBSUB_TOPIC",
    description: "Pub/Sub topic for Google Chat events",
    category: "platform",
    docsUrl: "https://cloud.google.com/pubsub/docs",
    platforms: ["gchat"],
  },
  {
    key: "GOOGLE_CHAT_IMPERSONATE_USER",
    description: "User email to impersonate for Google Chat",
    category: "platform",
    docsUrl: "https://developers.google.com/workspace/chat",
    platforms: ["gchat"],
  },
];

const CATEGORY_ORDER: EnvCategory[] = [
  "core",
  "provider",
  "platform",
  "plugin",
];

export const getEnvMetadata = (input: {
  authEnabled?: boolean;
  platforms: string[];
  plugins?: string[];
  provider?: Provider | null;
}): EnvVariableMeta[] => {
  const selectedPlatforms = new Set(input.platforms);
  const authEnabled = input.authEnabled ?? false;
  const provider = input.provider ?? null;

  const baseSelected = ENV_METADATA.map((meta, index) => ({ meta, index }))
    .filter(({ meta }) => {
      if (meta.providers && !(provider && meta.providers.includes(provider))) {
        return false;
      }
      if (meta.requiresAuth && !authEnabled) {
        return false;
      }
      if (
        meta.platforms &&
        !meta.platforms.some((platform) => selectedPlatforms.has(platform))
      ) {
        return false;
      }
      return true;
    })
    .map((entry) => entry.meta);

  const deduped = baseSelected
    .map((meta, index) => ({ meta, index }))
    .reduce((acc, entry) => {
      if (!acc.has(entry.meta.key)) {
        acc.set(entry.meta.key, entry);
      }
      return acc;
    }, new Map<string, { meta: EnvVariableMeta; index: number }>())
    .values();

  return Array.from(deduped)
    .sort((left, right) => {
      const categoryDelta =
        CATEGORY_ORDER.indexOf(left.meta.category) -
        CATEGORY_ORDER.indexOf(right.meta.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.meta);
};
