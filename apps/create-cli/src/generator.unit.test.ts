import { describe, expect, it } from "vitest";
import {
  createProjectFiles,
  getEnvMetadataForConfig,
  type ProjectFile,
} from "./generator";

describe("generator integration", () => {
  it("includes platform and auth env keys", () => {
    const variables = getEnvMetadataForConfig({
      authEnabled: true,
      platforms: ["web", "discord"],
      plugins: ["linear"],
    }).map((meta) => meta.key);

    expect(variables).toContain("DISCORD_BOT_TOKEN");
    expect(variables).toContain("DISCORD_PUBLIC_KEY");
    expect(variables).toContain("DISCORD_APPLICATION_ID");
    expect(variables).toContain("GOODCHAT_DASHBOARD_PASSWORD");
    expect(variables).toContain("GOODCHAT_AUTH_SECRET");
    expect(variables).toContain("CRON_SECRET");
  });

  it("creates docker sqlite scaffold with stable file contract", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
        databaseDialect: "sqlite",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["web"],
      },
      envMetadata: [
        {
          key: "OPENAI_API_KEY",
          description: "OpenAI API key",
          category: "provider",
        },
        {
          key: "GOODCHAT_DASHBOARD_PASSWORD",
          description: "Dashboard password",
          category: "core",
          requiresAuth: true,
        },
      ],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
    expect(new Set(filePaths).size).toBe(filePaths.length);
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("src/goodchat.ts");
    expect(filePaths).toContain("src/index.ts");
    expect(filePaths).toContain("src/env.ts");
    expect(filePaths).toContain(".env");
    expect(filePaths).toContain("src/db/schema.ts");
    expect(filePaths).toContain("src/db/core-schema.ts");
    expect(filePaths).toContain("src/db/auth-schema.ts");
    expect(filePaths).toContain("src/db/migrate.ts");
    expect(filePaths).toContain("src/db/plugins/schema.ts");
    expect(filePaths).toContain("drizzle.config.ts");
    expect(filePaths).toContain("Dockerfile");
    expect(filePaths).toContain(".dockerignore");
    expect(filePaths).toContain("docker-compose.yml");
    expect(filePaths).toContain("README.md");
    expect(filePaths).not.toContain("src/app.ts");

    const sqliteMigrateFile = files.find(
      (file) => file.path === "src/db/migrate.ts"
    );
    expect(sqliteMigrateFile?.content).toContain(
      "SQLite migrations applied successfully."
    );

    const sqliteComposeFile = files.find(
      (file) => file.path === "docker-compose.yml"
    );
    expect(sqliteComposeFile?.content).toContain("migrate:");
    expect(sqliteComposeFile?.content).toContain(
      "command: bun run src/db/migrate.ts"
    );
    expect(sqliteComposeFile?.content).toContain("app:");
    expect(sqliteComposeFile?.content).toContain("command: bun run start");
    expect(sqliteComposeFile?.content).not.toContain(
      "command: bun run db:migrate && bun run start"
    );
    expect(sqliteComposeFile?.content).not.toContain("depends_on:");
    expect(sqliteComposeFile?.content).toContain("goodchat-data:/data");
    expect(sqliteComposeFile?.content).toContain(
      "DATABASE_URL: /data/goodchat.db"
    );
  });

  it("creates railway deployment scaffold when railway target is selected", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
        databaseDialect: "postgres",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["web"],
      },
      deploymentTarget: "railway",
      envMetadata: [],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
    expect(filePaths).toContain("railway.json");
    expect(filePaths).toContain("README.md");
    expect(filePaths).not.toContain("Dockerfile");
    expect(filePaths).not.toContain(".dockerignore");
    expect(filePaths).not.toContain("vercel.json");
  });

  it("adds railway requiredMountPath for sqlite on railway target", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
        databaseDialect: "sqlite",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["web"],
      },
      deploymentTarget: "railway",
      envMetadata: [],
    });

    const railwayConfig = files.find((file) => file.path === "railway.json");
    expect(railwayConfig).toBeDefined();
    const parsedRailwayConfig = JSON.parse(railwayConfig?.content ?? "{}") as {
      deploy?: {
        requiredMountPath?: string;
      };
    };
    expect(parsedRailwayConfig.deploy?.requiredMountPath).toBe("/data");
  });

  it("creates vercel deployment scaffold when vercel target is selected", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
        databaseDialect: "postgres",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["web"],
      },
      deploymentTarget: "vercel",
      envMetadata: [],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
    expect(filePaths).toContain("vercel.json");
    expect(filePaths).toContain("README.md");
    expect(filePaths).not.toContain("Dockerfile");
    expect(filePaths).not.toContain(".dockerignore");
    expect(filePaths).not.toContain("railway.json");

    const indexFile = files.find((file) => file.path === "src/index.ts");
    const goodchatFile = files.find((file) => file.path === "src/goodchat.ts");
    const schemaFile = files.find((file) => file.path === "src/db/schema.ts");
    const tsconfigFile = files.find((file) => file.path === "tsconfig.json");
    expect(indexFile?.content).toContain(
      'if (process.env.VERCEL !== "1" && process.env.__VERCEL_DEV_RUNNING !== "1")'
    );
    expect(indexFile?.content).toContain('import "./env.js";');
    expect(indexFile?.content).toContain(
      'import { goodchat } from "./goodchat.js";'
    );
    expect(indexFile?.content).toContain("app.listen(port");
    expect(indexFile?.content).toContain(
      "// @ts-ignore TS6133: required for vercel platform detection"
    );
    expect(indexFile?.content).toContain('import { Elysia } from "elysia";');
    expect(indexFile?.content).toContain("export default app;");
    expect(goodchatFile?.content).toContain('import { schema } from "./db/schema.js";');
    expect(goodchatFile?.content).toContain('import { env } from "./env.js";');
    expect(schemaFile?.content).toContain(
      'import { authSchema } from "./auth-schema.js";'
    );
    expect(schemaFile?.content).toContain(
      'import { coreSchema } from "./core-schema.js";'
    );
    expect(schemaFile?.content).toContain(
      'import { pluginSchema } from "./plugins/schema.js";'
    );
    expect(tsconfigFile?.content).toContain('"module": "NodeNext"');
    expect(tsconfigFile?.content).toContain('"moduleResolution": "NodeNext"');
    expect(tsconfigFile?.content).toContain('"types": ["node"]');

    const vercelConfig = files.find((file) => file.path === "vercel.json");
    expect(vercelConfig).toBeDefined();
    expect(vercelConfig?.content).toContain(
      '"$schema": "https://openapi.vercel.sh/vercel.json"'
    );
    expect(vercelConfig?.content).not.toContain('"functions"');
    expect(vercelConfig?.content).not.toContain('"routes"');
  });

  it("adds discord cron path in vercel.json when discord platform is selected", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
        databaseDialect: "postgres",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["web", "discord"],
      },
      deploymentTarget: "vercel",
      envMetadata: [],
    });

    const vercelConfig = files.find((file) => file.path === "vercel.json");
    expect(vercelConfig?.content).toContain('"path": "/api/discord/gateway"');
  });
});
