import z from "zod";
import type { AIGatewayModelId } from "./catalog/ai-gateway";
import type { AnthropicModelId } from "./catalog/anthropic";
import type { GoogleModelId } from "./catalog/google";
import type { OpenAIModelId } from "./catalog/openai";
import type { OpenRouterModelId } from "./catalog/openrouter";
import type { VercelGatewayModelId } from "./catalog/vercel-gateway";

export const MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "ai-gateway",
  "vercel-gateway",
] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export interface ModelIdByProvider {
  "ai-gateway": AIGatewayModelId;
  anthropic: AnthropicModelId;
  google: GoogleModelId;
  openai: OpenAIModelId;
  openrouter: OpenRouterModelId;
  "vercel-gateway": VercelGatewayModelId;
}

export interface ModelRef<TProvider extends ModelProvider = ModelProvider> {
  readonly modelId: ModelIdByProvider[TProvider];
  readonly provider: TProvider;
}

const openaiModelRefSchema = z.object({
  provider: z.literal("openai"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"openai">>;

const anthropicModelRefSchema = z.object({
  provider: z.literal("anthropic"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"anthropic">>;

const googleModelRefSchema = z.object({
  provider: z.literal("google"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"google">>;

const openrouterModelRefSchema = z.object({
  provider: z.literal("openrouter"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"openrouter">>;

const aiGatewayModelRefSchema = z.object({
  provider: z.literal("ai-gateway"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"ai-gateway">>;

const vercelGatewayModelRefSchema = z.object({
  provider: z.literal("vercel-gateway"),
  modelId: z.string(),
}) satisfies z.ZodType<ModelRef<"vercel-gateway">>;

export const modelRefSchema = z.discriminatedUnion("provider", [
  openaiModelRefSchema,
  anthropicModelRefSchema,
  googleModelRefSchema,
  openrouterModelRefSchema,
  aiGatewayModelRefSchema,
  vercelGatewayModelRefSchema,
]) satisfies z.ZodType<ModelRef>;
