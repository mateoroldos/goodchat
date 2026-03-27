export type Provider = "gateway" | "openai" | "anthropic" | "google";

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
  schema?: string;
}

const ENV_METADATA: EnvVariableMeta[] = [
  {
    key: "OPENAI_API_KEY",
    description: "OpenAI API key for direct provider usage",
    category: "provider",
    docsUrl: "https://platform.openai.com/api-keys",
    schema: 'z.string().min(1, "OpenAI API key is required")',
    providers: ["openai"],
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Anthropic API key for direct provider usage",
    category: "provider",
    docsUrl: "https://console.anthropic.com/settings/keys",
    schema: 'z.string().min(1, "Anthropic API key is required")',
    providers: ["anthropic"],
  },
  {
    key: "GOOGLE_GENERATIVE_AI_API_KEY",
    description: "Google Generative AI API key",
    category: "provider",
    docsUrl: "https://aistudio.google.com/app/apikey",
    schema: 'z.string().min(1, "Google Generative AI API key is required")',
    providers: ["google"],
  },
  {
    key: "AI_GATEWAY_API_KEY",
    description: "Vercel AI Gateway API key",
    category: "provider",
    docsUrl:
      "https://vercel.com/docs/ai-gateway/authentication-and-byok/authentication",
    schema: 'z.string().min(1, "AI Gateway API key is required")',
    providers: ["gateway"],
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

export const resolveProviderFromModelId = (
  modelId: string | undefined
): Provider | null => {
  if (!modelId) {
    return null;
  }
  if (modelId.includes("/")) {
    return "gateway";
  }
  const [provider] = modelId.split(":", 1);
  if (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "google"
  ) {
    return provider;
  }
  return null;
};

export const getEnvMetadata = (input: {
  platforms: string[];
  plugins?: string[];
  provider?: Provider | null;
}): EnvVariableMeta[] => {
  const selectedPlatforms = new Set(input.platforms);
  const provider = input.provider ?? null;

  const baseSelected = ENV_METADATA.map((meta, index) => ({ meta, index }))
    .filter(({ meta }) => {
      if (meta.providers && !(provider && meta.providers.includes(provider))) {
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
