import type { ModelRef } from "../model-ref";

export const OPENAI_KNOWN_MODELS = [
  // GPT-5.4 series (latest frontier)
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  // GPT-5 series
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  // GPT-4.1 series
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  // GPT-4o series
  "gpt-4o",
  "gpt-4o-mini",
  // Reasoning models
  "o3",
  "o3-pro",
  "o3-mini",
  "o4-mini",
] as const;

export type OpenAIModelId =
  | (typeof OPENAI_KNOWN_MODELS)[number]
  | (string & {});

export const openai = (modelId: OpenAIModelId): ModelRef<"openai"> => ({
  provider: "openai",
  modelId,
});
