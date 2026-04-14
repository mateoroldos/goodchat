import { AI_GATEWAY_KNOWN_MODELS } from "./catalog/ai-gateway";
import { ANTHROPIC_KNOWN_MODELS } from "./catalog/anthropic";
import { GOOGLE_KNOWN_MODELS } from "./catalog/google";
import { OPENAI_KNOWN_MODELS } from "./catalog/openai";
import { OPENROUTER_KNOWN_MODELS } from "./catalog/openrouter";
import { VERCEL_GATEWAY_KNOWN_MODELS } from "./catalog/vercel-gateway";
import {
  MODEL_PROVIDERS,
  type ModelProvider,
  type ModelRef,
} from "./model-ref";

export interface ProviderEnvVariableMetadata {
  description: string;
  docsUrl: string;
  key: string;
  promptForValue?: boolean;
  requiredMessage: string;
}

export interface ProviderMetadata {
  envVariables: readonly ProviderEnvVariableMetadata[];
  factoryName: string;
  knownModels: readonly string[];
  label: string;
}

export const PROVIDER_METADATA: Record<ModelProvider, ProviderMetadata> = {
  openai: {
    envVariables: [
      {
        key: "OPENAI_API_KEY",
        description: "OpenAI API key",
        docsUrl: "https://platform.openai.com/api-keys",
        requiredMessage: "OpenAI API key is required",
        promptForValue: true,
      },
    ],
    label: "OpenAI",
    factoryName: "openai",
    knownModels: OPENAI_KNOWN_MODELS,
  },
  anthropic: {
    envVariables: [
      {
        key: "ANTHROPIC_API_KEY",
        description: "Anthropic API key",
        docsUrl: "https://console.anthropic.com/settings/keys",
        requiredMessage: "Anthropic API key is required",
        promptForValue: true,
      },
    ],
    label: "Anthropic",
    factoryName: "anthropic",
    knownModels: ANTHROPIC_KNOWN_MODELS,
  },
  google: {
    envVariables: [
      {
        key: "GOOGLE_GENERATIVE_AI_API_KEY",
        description: "Google Generative AI API key",
        docsUrl: "https://aistudio.google.com/app/apikey",
        requiredMessage: "Google Generative AI API key is required",
        promptForValue: true,
      },
    ],
    label: "Google",
    factoryName: "google",
    knownModels: GOOGLE_KNOWN_MODELS,
  },
  openrouter: {
    envVariables: [
      {
        key: "OPENROUTER_API_KEY",
        description: "OpenRouter API key",
        docsUrl: "https://openrouter.ai/settings/keys",
        requiredMessage: "OpenRouter API key is required",
        promptForValue: true,
      },
    ],
    label: "OpenRouter",
    factoryName: "openrouter",
    knownModels: OPENROUTER_KNOWN_MODELS,
  },
  "ai-gateway": {
    envVariables: [
      {
        key: "CLOUDFLARE_ACCOUNT_ID",
        description: "Cloudflare account ID for Workers AI",
        docsUrl:
          "https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/",
        requiredMessage: "Cloudflare account ID is required",
      },
      {
        key: "AI_GATEWAY_API_KEY",
        description: "Cloudflare Workers AI API token",
        docsUrl: "https://developers.cloudflare.com/workers-ai/",
        requiredMessage: "Cloudflare Workers AI API token is required",
        promptForValue: true,
      },
    ],
    label: "AI Gateway (Cloudflare Workers AI)",
    factoryName: "aiGateway",
    knownModels: AI_GATEWAY_KNOWN_MODELS,
  },
  "vercel-gateway": {
    envVariables: [
      {
        key: "VERCEL_AI_GATEWAY_TOKEN",
        description: "Vercel AI Gateway token",
        docsUrl:
          "https://vercel.com/docs/ai-gateway/authentication-and-byok/authentication",
        requiredMessage: "Vercel AI Gateway token is required",
        promptForValue: true,
      },
    ],
    label: "Vercel AI Gateway",
    factoryName: "vercelGateway",
    knownModels: VERCEL_GATEWAY_KNOWN_MODELS,
  },
};

export const MODEL_PROVIDER_OPTIONS = MODEL_PROVIDERS.map((provider) => ({
  label: PROVIDER_METADATA[provider].label,
  value: provider,
}));

export const MODEL_CATALOG: Record<ModelProvider, readonly string[]> =
  MODEL_PROVIDERS.reduce<Record<ModelProvider, readonly string[]>>(
    (catalog, provider) => {
      catalog[provider] = PROVIDER_METADATA[provider].knownModels;
      return catalog;
    },
    {} as Record<ModelProvider, readonly string[]>
  );

export const MODEL_PROVIDER_REQUIRED_ENV_KEYS: Record<
  ModelProvider,
  readonly string[]
> = MODEL_PROVIDERS.reduce<Record<ModelProvider, readonly string[]>>(
  (result, provider) => {
    result[provider] = PROVIDER_METADATA[provider].envVariables.map(
      (variable) => variable.key
    );
    return result;
  },
  {} as Record<ModelProvider, readonly string[]>
);

export const MODEL_PROVIDER_PROMPT_ENV_KEY: Partial<
  Record<ModelProvider, string>
> = MODEL_PROVIDERS.reduce<Partial<Record<ModelProvider, string>>>(
  (result, provider) => {
    const promptVariable = PROVIDER_METADATA[provider].envVariables.find(
      (variable) => variable.promptForValue
    );
    if (promptVariable) {
      result[provider] = promptVariable.key;
    }
    return result;
  },
  {}
);

export const MODEL_PROVIDER_PROMPT_DOCS_URL: Partial<
  Record<ModelProvider, string>
> = MODEL_PROVIDERS.reduce<Partial<Record<ModelProvider, string>>>(
  (result, provider) => {
    const promptVariable = PROVIDER_METADATA[provider].envVariables.find(
      (variable) => variable.promptForValue
    );
    if (promptVariable) {
      result[provider] = promptVariable.docsUrl;
    }
    return result;
  },
  {}
);

export const resolveModelFactoryName = (provider: ModelRef["provider"]) => {
  return PROVIDER_METADATA[provider].factoryName;
};
