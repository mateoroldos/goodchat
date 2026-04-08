import type z from "zod";
import type {
  authConfigSchema,
  authModeSchema,
  botConfigSchema,
  databaseDialectSchema,
  platformSchema,
} from "./models";

export type Platform = z.infer<typeof platformSchema>;
export type DatabaseDialect = z.infer<typeof databaseDialectSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type BotConfig = BotConfigInput & {
  id: string;
};
