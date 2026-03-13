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

export const rawBotConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
});

export type RawBotConfig = z.infer<typeof rawBotConfigSchema>;

export const botConfigsSchema = z.object({
  bots: z.array(rawBotConfigSchema).min(1, "At least one bot is required"),
});

export type BotConfigs = z.infer<typeof botConfigsSchema>;

export type BotConfig = RawBotConfig & {
  id: string;
};
