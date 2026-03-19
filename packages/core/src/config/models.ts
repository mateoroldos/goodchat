import z from "zod";

export const CHAT_PLATFORMS = [
  "local",
  "slack",
  "discord",
  "teams",
  "gchat",
] as const;

export const platformSchema = z.enum(CHAT_PLATFORMS);

export type Platform = z.infer<typeof platformSchema>;

export const botConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
});

export type BotConfigInput = z.infer<typeof botConfigSchema>;

export type BotConfig = BotConfigInput & {
  id: string;
};

export const deriveBotId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
