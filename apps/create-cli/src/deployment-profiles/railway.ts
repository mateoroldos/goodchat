import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import type { GeneratorConfig, ProjectFile } from "../scaffold-types";
import { readmeHeader } from "./shared";

const renderRailwayJson = (dialect: DatabaseDialect): string =>
  `${JSON.stringify(
    {
      $schema: "https://railway.com/railway.schema.json",
      build: { builder: "RAILPACK" },
      deploy: {
        preDeployCommand: "bun run db:migrate",
        startCommand: "bun run start",
        restartPolicyType: "ON_FAILURE",
        restartPolicyMaxRetries: 10,
        ...(dialect === "sqlite" ? { requiredMountPath: "/data" } : {}),
      },
    },
    null,
    2
  )}\n`;

const renderReadme = (config: GeneratorConfig): string => {
  const dbNote =
    config.databaseDialect === "sqlite"
      ? "SQLite selected: mount a Railway volume at `/data` and set `DATABASE_URL=/data/goodchat.db`."
      : "Use managed Postgres/MySQL and set `DATABASE_URL` to the provider URL.";

  return [
    ...readmeHeader(config),
    "## Railway Deploy",
    "",
    "1. Create a Railway service from this repo.",
    "2. Keep generated `railway.json` as-is.",
    "3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).",
    "4. Deploy.",
    "",
    "Quick CLI path: `bun run railway:link`, then `bun run railway:up`.",
    "",
    "Railway runs `bun run db:migrate` before `bun run start`.",
    dbNote,
    "",
    "If deploy fails, check migration output first. The app usually just reports the bad news.",
  ].join("\n");
};

export const railwayProfile = {
  allowedDialects: ["sqlite", "postgres", "mysql"] as const,
  isServerless: false,
  scripts: () => ({
    build: "tsdown",
    start: "bun run dist/index.mjs",
    "railway:link": "bunx @railway/cli link",
    "railway:up": "bunx @railway/cli up",
    "railway:logs": "bunx @railway/cli logs",
    "railway:migrate": "bunx @railway/cli run bun run db:migrate",
  }),
  configFiles: (config: GeneratorConfig): ProjectFile[] => [
    {
      path: "railway.json",
      content: renderRailwayJson(config.databaseDialect),
    },
  ],
  readme: renderReadme,
};
