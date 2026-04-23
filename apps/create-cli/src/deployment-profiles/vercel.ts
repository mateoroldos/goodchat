import type { GeneratorConfig, ProjectFile } from "../scaffold-types";
import { readmeHeader } from "./shared";

const renderVercelJson = (config: GeneratorConfig): string => {
  const crons = config.platforms.includes("discord")
    ? [{ path: "/api/discord/gateway", schedule: "*/9 * * * *" }]
    : undefined;
  const base = {
    $schema: "https://openapi.vercel.sh/vercel.json",
  };
  return `${JSON.stringify(crons ? { ...base, crons } : base, null, 2)}\n`;
};

const renderReadme = (config: GeneratorConfig): string =>
  [
    ...readmeHeader(config),
    "## Vercel Deploy",
    "",
    "1. Import the project in Vercel.",
    "2. Keep generated `vercel.json` as-is.",
    "3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).",
    "4. Deploy.",
    "",
    "Quick CLI path: `bun run vercel:link` then `bun run vercel:deploy:prod`.",
    "",
    "Use external Postgres/MySQL. SQLite is not scaffolded for Vercel because temporary files are not a database strategy.",
    "",
    "For other serverless hosts, use the same `src/index.ts` shape: export `app` and skip `app.listen`.",
  ].join("\n");

export const vercelProfile = {
  allowedDialects: ["postgres", "mysql"] as const,
  isServerless: true,
  scripts: () => ({
    "vercel:link": "bunx vercel@latest link",
    "vercel:dev": "bunx vercel@latest dev",
    "vercel:deploy": "bunx vercel@latest",
    "vercel:deploy:prod": "bunx vercel@latest --prod",
    "vercel:logs": "bunx vercel@latest logs",
  }),
  configFiles: (config: GeneratorConfig): ProjectFile[] => [
    { path: "vercel.json", content: renderVercelJson(config) },
  ],
  readme: renderReadme,
};
