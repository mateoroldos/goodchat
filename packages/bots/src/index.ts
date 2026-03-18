import type { RawBotConfig } from "@goodchat/core/config/models";
import { localEcho } from "./local-echo";
import { supportEcho } from "./support-echo";

export const bots = {
  localEcho,
  supportEcho,
} satisfies Record<string, RawBotConfig>;
