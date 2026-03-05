import type { z } from "zod";
import type { botConfigSchema, incomingMessageSchema } from "./schema";

export type BotConfig = z.infer<typeof botConfigSchema>;
export type IncomingMessage = z.infer<typeof incomingMessageSchema>;
export interface BotResponse {
  text: string;
}
export type Platform = BotConfig["platforms"][number];
