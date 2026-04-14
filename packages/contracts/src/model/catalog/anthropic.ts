import type { ModelRef } from "../model-ref";

export const ANTHROPIC_KNOWN_MODELS = [
  // Current flagship aliases (always route to latest snapshot)
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  // Versioned snapshots for pinning
  "claude-haiku-4-5-20251001",
  "claude-opus-4-5-20251101",
  "claude-sonnet-4-5-20250929",
] as const;

export type AnthropicModelId =
  | (typeof ANTHROPIC_KNOWN_MODELS)[number]
  | (string & {});

export const anthropic = (
  modelId: AnthropicModelId
): ModelRef<"anthropic"> => ({
  provider: "anthropic",
  modelId,
});
