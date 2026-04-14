import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type {
  ModelIdByProvider,
  ModelProvider,
  ModelRef,
} from "@goodchat/contracts/model/model-ref";
import {
  MODEL_PROVIDER_REQUIRED_ENV_KEYS,
  PROVIDER_METADATA,
} from "@goodchat/contracts/model/provider-metadata";
import type { LanguageModel } from "ai";

type ProviderEnvironment = Record<string, string | undefined>;

type ProviderResolver<P extends ModelProvider = ModelProvider> = (
  modelId: ModelIdByProvider[P]
) => LanguageModel;

export type ProviderRegistry = {
  [Provider in ModelProvider]: ProviderResolver<Provider>;
};

export const getMissingProviderEnvKeys = (
  provider: ModelProvider,
  env: ProviderEnvironment = process.env
): string[] => {
  const requiredKeys = MODEL_PROVIDER_REQUIRED_ENV_KEYS[provider];
  return requiredKeys.filter((key) => !env[key]?.trim());
};

export const validateModelProviderConfig = (
  model: ModelRef,
  env: ProviderEnvironment = process.env
): void => {
  const missingKeys = getMissingProviderEnvKeys(model.provider, env);
  if (missingKeys.length === 0) {
    return;
  }

  const providerLabel = PROVIDER_METADATA[model.provider].label;
  throw new Error(
    `Missing required environment variables for ${providerLabel}: ${missingKeys.join(", ")}`
  );
};

const resolveProviderModel = <Provider extends ModelProvider>(
  provider: Provider,
  modelId: ModelIdByProvider[Provider],
  env: ProviderEnvironment
): LanguageModel => {
  switch (provider) {
    case "openai": {
      const openaiProvider = createOpenAI({
        name: "openai",
        apiKey: env.OPENAI_API_KEY,
      });
      return openaiProvider(modelId);
    }
    case "anthropic": {
      const anthropicProvider = createAnthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });
      return anthropicProvider(modelId);
    }
    case "google": {
      const googleProvider = createGoogleGenerativeAI({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return googleProvider(modelId);
    }
    case "openrouter": {
      const openrouterProvider = createOpenAI({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
      });
      return openrouterProvider(modelId);
    }
    case "ai-gateway": {
      const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
      if (!accountId) {
        throw new Error("CLOUDFLARE_ACCOUNT_ID is required for AI Gateway");
      }
      const aiGatewayProvider = createOpenAI({
        name: "ai-gateway",
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
        apiKey: env.AI_GATEWAY_API_KEY,
      });
      return aiGatewayProvider(modelId);
    }
    case "vercel-gateway": {
      const vercelGatewayProvider = createOpenAI({
        name: "vercel-gateway",
        baseURL: "https://ai-gateway.vercel.sh/v1",
        apiKey: env.VERCEL_AI_GATEWAY_TOKEN,
      });
      return vercelGatewayProvider(modelId);
    }
    default: {
      const exhaustiveProvider: never = provider;
      throw new Error(
        `Unsupported model provider: ${String(exhaustiveProvider)}`
      );
    }
  }
};

export const resolveModelFromRegistry = <Provider extends ModelProvider>(
  model: ModelRef<Provider>,
  env: ProviderEnvironment = process.env
): LanguageModel => {
  validateModelProviderConfig(model, env);
  return resolveProviderModel(model.provider, model.modelId, env);
};
