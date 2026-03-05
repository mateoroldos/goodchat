import { z } from "zod";

export const botConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(z.literal("local")).min(1, "Platform is required"),
});

export const incomingMessageSchema = z.object({
  botName: z.string().min(1, "Bot name is required"),
  platform: z.literal("local"),
  text: z.string().min(1, "Text is required"),
  threadId: z.string().min(1, "Thread ID is required"),
  userId: z.string().min(1, "User ID is required"),
});
