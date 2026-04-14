import type { ModelRef } from "../model-ref";

export const VERCEL_GATEWAY_KNOWN_MODELS = [
  // OpenAI
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o3",
  "openai/o4-mini",
  // Anthropic
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  // Google
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  // Meta
  "meta/llama-4-maverick",
  "meta/llama-4-scout",
] as const;

export type VercelGatewayModelId =
  | (typeof VERCEL_GATEWAY_KNOWN_MODELS)[number]
  | (string & {});

export const vercelGateway = (
  modelId: VercelGatewayModelId
): ModelRef<"vercel-gateway"> => ({
  provider: "vercel-gateway",
  modelId,
});
