import type z from "zod";
import type {
  botConfigSchema,
  databaseDialectSchema,
  platformSchema,
} from "./models";

export type Platform = z.infer<typeof platformSchema>;
export type DatabaseDialect = z.infer<typeof databaseDialectSchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type BotConfig = BotConfigInput & {
  id: string;
};
