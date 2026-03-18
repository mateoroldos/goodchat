import { type BotConfig, type BotConfigInput, botConfigSchema } from "./models";

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
  const id = parsed.id ?? getBotIdFromExportName(exportName);

  return {
    ...parsed,
    id,
    platforms: Array.from(new Set(parsed.platforms)),
  };
};
