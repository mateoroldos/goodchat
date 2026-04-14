import type { ModelRef } from "../model-ref";

export const GOOGLE_KNOWN_MODELS = [
  // Gemini 2.5 series — GA
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

export type GoogleModelId =
  | (typeof GOOGLE_KNOWN_MODELS)[number]
  | (string & {});

export const google = (modelId: GoogleModelId): ModelRef<"google"> => ({
  provider: "google",
  modelId,
});
