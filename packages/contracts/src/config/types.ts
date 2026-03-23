import type z from "zod";
import type { botConfigSchema, platformSchema } from "./models";

export type Platform = z.infer<typeof platformSchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type BotConfig = BotConfigInput & {
  id: string;
};
