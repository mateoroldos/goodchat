import type { ModelRef } from "@goodchat/contracts/model/model-ref";
import { PROVIDER_METADATA } from "@goodchat/contracts/model/provider-metadata";
import { describe, expect, it } from "vitest";
import {
  resolveModelFromRegistry,
  validateModelProviderConfig,
} from "./provider-registry";

const PROVIDER_CASES: Array<{
  env: Record<string, string>;
  missingKeys: string[];
  model: ModelRef;
}> = [
  {
    model: { provider: "openai", modelId: "gpt-4.1-mini" },
    env: { OPENAI_API_KEY: "test-openai-key" },
    missingKeys: ["OPENAI_API_KEY"],
  },
  {
    model: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
    env: { ANTHROPIC_API_KEY: "test-anthropic-key" },
    missingKeys: ["ANTHROPIC_API_KEY"],
  },
  {
    model: { provider: "google", modelId: "gemini-2.5-flash" },
    env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key" },
    missingKeys: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  },
  {
    model: { provider: "openrouter", modelId: "openai/gpt-4.1-mini" },
    env: { OPENROUTER_API_KEY: "test-openrouter-key" },
    missingKeys: ["OPENROUTER_API_KEY"],
  },
  {
    model: {
      provider: "ai-gateway",
      modelId: "@cf/meta/llama-3.1-8b-instruct",
    },
    env: {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      AI_GATEWAY_API_KEY: "test-ai-gateway-key",
    },
    missingKeys: ["CLOUDFLARE_ACCOUNT_ID", "AI_GATEWAY_API_KEY"],
  },
  {
    model: { provider: "vercel-gateway", modelId: "openai/gpt-4.1-mini" },
    env: { VERCEL_AI_GATEWAY_TOKEN: "test-vercel-token" },
    missingKeys: ["VERCEL_AI_GATEWAY_TOKEN"],
  },
];

describe("provider registry", () => {
  it.each(PROVIDER_CASES)("validates and resolves $model.provider models", ({
    model,
    env,
  }) => {
    expect(() => validateModelProviderConfig(model, env)).not.toThrow();
    const resolvedModel = resolveModelFromRegistry(model, env);
    expect(resolvedModel).toBeTruthy();
  });

  it.each(
    PROVIDER_CASES
  )("fails validation when env is missing for $model.provider", ({
    model,
    missingKeys,
  }) => {
    expect(() => validateModelProviderConfig(model, {})).toThrow(
      missingKeys.join(", ")
    );
    expect(() => validateModelProviderConfig(model, {})).toThrow(
      PROVIDER_METADATA[model.provider].label
    );
  });

  it.each(
    PROVIDER_CASES
  )("fails validation when env contains blank values for $model.provider", ({
    model,
    missingKeys,
  }) => {
    const blankEnv = missingKeys.reduce<Record<string, string>>((env, key) => {
      env[key] = "   ";
      return env;
    }, {});

    expect(() => validateModelProviderConfig(model, blankEnv)).toThrow(
      missingKeys.join(", ")
    );
  });

  it.each(
    PROVIDER_CASES
  )("resolveModelFromRegistry fails when env is missing for $model.provider", ({
    model,
    missingKeys,
  }) => {
    expect(() => resolveModelFromRegistry(model, {})).toThrow(
      missingKeys.join(", ")
    );
  });

  it("throws a provider-specific message for missing cloudflare account id", () => {
    const model: ModelRef<"ai-gateway"> = {
      provider: "ai-gateway",
      modelId: "@cf/meta/llama-3.1-8b-instruct",
    };

    expect(() =>
      resolveModelFromRegistry(model, {
        AI_GATEWAY_API_KEY: "test-ai-gateway-key",
      })
    ).toThrow("CLOUDFLARE_ACCOUNT_ID");
  });
});
