import figlet from "figlet";
import type { GeneratorConfig } from "../scaffold-types";

export const renderAsciiTitle = (value: string): string => {
  const normalized = value.trim().slice(0, 24);
  const safeValue = normalized.length > 0 ? normalized : "goodchat";
  try {
    return figlet.textSync(safeValue, {
      font: "Larry 3D",
      horizontalLayout: "fitted",
      verticalLayout: "default",
      whitespaceBreak: true,
      width: 120,
    });
  } catch {
    return safeValue;
  }
};

export const readmeHeader = (config: GeneratorConfig): string[] => [
  "# Goodchat Deployment Guide",
  "",
  "```text",
  renderAsciiTitle(config.name),
  "```",
  "",
  "## About This Bot",
  "",
  `- Name: ${config.name}`,
  `- Platforms: ${config.platforms.join(", ")}`,
  "- Runtime config: `src/goodchat.ts`",
  "",
  "This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.",
];
