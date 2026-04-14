import type { ModelRef } from "../model-ref";

export const AI_GATEWAY_KNOWN_MODELS = [
  // Meta Llama
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-3.1-70b-instruct",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  // Qwen
  "@cf/qwen/qwq-32b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/qwen/qwen2.5-coder-32b-instruct",
  // Mistral
  "@cf/mistralai/mistral-small-3.1-24b-instruct",
  "@cf/mistralai/mistral-7b-instruct-v0.2",
  // Google
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/google/gemma-3-12b-it",
  // DeepSeek
  "@cf/deepseek/deepseek-r1-distill-qwen-32b",
] as const;

export type AIGatewayModelId =
  | (typeof AI_GATEWAY_KNOWN_MODELS)[number]
  | (string & {});

export const aiGateway = (
  modelId: AIGatewayModelId
): ModelRef<"ai-gateway"> => ({
  provider: "ai-gateway",
  modelId,
});
