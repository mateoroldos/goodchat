import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import type { GeneratorConfig, ProjectFile } from "../scaffold-types";
import { readmeHeader } from "./shared";

const renderDockerfile = (): string => `FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "start"]
`;

const renderDockerignore = (): string => `node_modules
dist
.git
.env
`;

const renderDockerCompose = (): string => `services:
  migrate:
    build:
      context: .
    env_file:
      - .env
    environment:
      DATABASE_URL: /data/goodchat.db
    command: bun run src/db/migrate.ts
    volumes:
      - goodchat-data:/data

  app:
    build:
      context: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      DATABASE_URL: /data/goodchat.db
    command: bun run start
    volumes:
      - goodchat-data:/data

volumes:
  goodchat-data:
`;

const renderReadme = (config: GeneratorConfig): string => {
  const isSqlite = config.databaseDialect === "sqlite";
  const deployBlock = isSqlite
    ? [
        "## Docker Deploy (SQLite)",
        "",
        "```bash",
        "bun run docker:migrate",
        "bun run docker:up",
        "```",
        "",
        "SQLite is mounted at `/data/goodchat.db` inside the container. If you delete the volume, your memory resets too.",
      ]
    : [
        "## Docker Deploy",
        "",
        "```bash",
        "bun run docker:build",
        "bun run docker:run",
        "```",
        "",
        "Run migrations before app startup, unless chaos engineering is your product strategy.",
      ];

  const devNote = isSqlite
    ? "Host dev uses `./goodchat.db`. Docker SQLite mode uses `/data/goodchat.db` in the container volume.\nUse `bun run docker:dev` for attached Docker logs, `bun run docker:up` for background startup, or `bun run docker:ready` in CI when you need migration + health checks before continuing."
    : "Run app in Docker when you want parity. Run host dev when you want speed and fewer container logs to ignore.";

  return [
    ...readmeHeader(config),
    ...deployBlock,
    "",
    "## Local Dev",
    "",
    "```bash",
    "bun run db:generate",
    "bun run db:migrate",
    "bun run dev",
    "```",
    "",
    devNote,
  ].join("\n");
};

const DOCKER_SCRIPTS = {
  build: "tsdown",
  start: "bun run dist/index.mjs",
  "docker:build": "docker build -t goodchat-bot .",
  "docker:run": "docker run -p 3000:3000 --env-file .env goodchat-bot",
} as const;

const DOCKER_SQLITE_SCRIPTS = {
  ...DOCKER_SCRIPTS,
  "docker:dev": "docker compose up app",
  "docker:rebuild": "docker compose up --build app",
  "docker:up": "docker compose up -d app",
  "docker:ready":
    "docker compose run --rm migrate && docker compose up -d --wait --wait-timeout 60 app",
  "docker:migrate": "docker compose run --rm migrate",
  "docker:start": "docker compose up -d app",
  "docker:down": "docker compose down --remove-orphans",
  "docker:logs": "docker compose logs -f app",
  "docker:ps": "docker compose ps --all",
  "docker:check": "docker compose ps --format json app",
} as const;

export const dockerProfile = {
  allowedDialects: ["sqlite", "postgres", "mysql"] as const,
  isServerless: false,
  scripts: (dialect: DatabaseDialect) =>
    dialect === "sqlite" ? DOCKER_SQLITE_SCRIPTS : DOCKER_SCRIPTS,
  configFiles: (config: GeneratorConfig): ProjectFile[] => [
    { path: "Dockerfile", content: renderDockerfile() },
    { path: ".dockerignore", content: renderDockerignore() },
    ...(config.databaseDialect === "sqlite"
      ? [{ path: "docker-compose.yml", content: renderDockerCompose() }]
      : []),
  ],
  readme: renderReadme,
};
