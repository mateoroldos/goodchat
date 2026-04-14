import type { ModelRef } from "../model-ref";

export const OPENROUTER_KNOWN_MODELS = [
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
  // xAI
  "x-ai/grok-4",
  "x-ai/grok-4.1-fast",
  // Meta
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout",
  // DeepSeek
  "deepseek/deepseek-chat-v3-0324",
] as const;

export type OpenRouterModelId =
  | (typeof OPENROUTER_KNOWN_MODELS)[number]
  | (string & {});

export const openrouter = (
  modelId: OpenRouterModelId
): ModelRef<"openrouter"> => ({
  provider: "openrouter",
  modelId,
});
