import type { Platform } from "@goodchat/contracts/config/types";
import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
import { MODEL_PROVIDERS } from "@goodchat/contracts/model/model-ref";
import { PROVIDER_METADATA } from "@goodchat/contracts/model/provider-metadata";
import { PLATFORM_METADATA } from "@goodchat/contracts/platform/platform-metadata";

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
  ...(
    Object.entries(PLATFORM_METADATA) as [
      Platform,
      (typeof PLATFORM_METADATA)[Platform],
    ][]
  ).flatMap(([platform, metadata]): EnvVariableMeta[] => {
    return metadata.envVariables.map((variable) => ({
      key: variable.key,
      description: variable.description,
      category: "platform",
      docsUrl: variable.docsUrl,
      platforms: [platform],
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
    key: "CRON_SECRET",
    description: "Secret used to authorize cron requests",
    category: "core",
    schema: "z.string().optional()",
  },
  {
    key: "ENVIRONMENT",
    description: "Runtime environment",
    category: "core",
    schema: 'z.enum(["development", "test", "production"]).optional()',
  },
  {
    key: "SERVERLESS",
    description: "Set to true when running on serverless platforms",
    category: "core",
    schema: 'z.enum(["true", "false"]).optional()',
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
