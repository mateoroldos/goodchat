import { botConfigSchema } from "./models";
import type { BotConfig, BotConfigInput } from "./types";

const slugifyBotId = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

export const getBotIdFromExportName = (exportName: string) =>
  slugifyBotId(exportName);

export const normalizeBotConfig = (
  input: BotConfigInput,
  exportName: string
): BotConfig => {
  const parsed = botConfigSchema.parse(input);
  const id = getBotIdFromExportName(exportName);

  return {
    ...parsed,
    id,
    platforms: Array.from(new Set(parsed.platforms)),
  };
};

export const deriveBotId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
