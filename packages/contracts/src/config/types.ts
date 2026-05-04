import type z from "zod";
import type { BotAfterMessageHook, BotBeforeMessageHook } from "../hooks/types";
import type {
  authConfigSchema,
  authModeSchema,
  botConfigSchema,
  databaseDialectSchema,
  platformSchema,
  stateAdapterSchema,
  stateConfigSchema,
} from "./models";

export type Platform = z.infer<typeof platformSchema>;
export type DatabaseDialect = z.infer<typeof databaseDialectSchema>;
export type AuthMode = z.infer<typeof authModeSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type StateAdapter = z.infer<typeof stateAdapterSchema>;
export type StateConfig = z.infer<typeof stateConfigSchema>;
export type BotConfigInput = z.input<typeof botConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

export type Bot = Omit<BotConfig, "hooks"> & {
  id: string;
  systemPrompt?: string;
  hooks: {
    afterMessage: BotAfterMessageHook[];
    beforeMessage: BotBeforeMessageHook[];
  };
};
