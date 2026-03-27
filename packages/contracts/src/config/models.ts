import z from "zod";

export const CHAT_PLATFORMS = [
  "local",
  "slack",
  "discord",
  "teams",
  "gchat",
] as const;

export const platformSchema = z.enum(CHAT_PLATFORMS);

const LLM_MODEL_ID_REGEX = /^[a-z0-9-]+\/[\w.-]+$/i;

export const botConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
  modelId: z
    .string()
    .regex(LLM_MODEL_ID_REGEX, "Model must be in provider/model format")
    .optional(),
});
