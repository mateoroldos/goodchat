import z from "zod";

export const webhookSchema = z.object({
  botName: z.string().min(1, "Bot name is required"),
  text: z.string().min(1, "Text is required"),
  userId: z.string().min(1, "User ID is required"),
  threadId: z.string().min(1, "Thread ID is required"),
});
