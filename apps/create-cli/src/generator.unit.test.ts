import { describe, expect, it } from "vitest";
import {
  createProjectFiles,
  getEnvMetadataForConfig,
  type ProjectFile,
  renderEnvSchemaFile,
  renderGoodchatFile,
  renderPackageJson,
} from "./generator";

describe("generator helpers", () => {
  it("includes platform env keys", () => {
    const variables = getEnvMetadataForConfig({
      platforms: ["local", "discord"],
      plugins: ["linear"],
    }).map((meta) => meta.key);

    expect(variables).toContain("DISCORD_BOT_TOKEN");
    expect(variables).toContain("DISCORD_PUBLIC_KEY");
    expect(variables).toContain("DISCORD_APPLICATION_ID");
  });

  it("renders goodchat runtime file with plugins and mcp", () => {
    const result = renderGoodchatFile({
      databaseDialect: "sqlite",
      name: "Support Bot",
      prompt: "Be helpful",
      platforms: ["local", "slack"],
      withDashboard: true,
      isServerless: false,
      model: "openai/gpt-4.1-mini",
      plugins: ["linear"],
      mcp: [
        {
          name: "notion",
          transport: { type: "http", url: "https://mcp.notion" },
        },
      ],
    });

    expect(result).toContain("plugins: [linear]");
    expect(result).toContain("mcp:");
    expect(result).toContain("https://mcp.notion");
    expect(result).toContain('name: "Support Bot"');
    expect(result).toContain("export const goodchat = {");
    expect(result).toContain(
      'database: sqlite({ path: process.env.DATABASE_URL || "./goodchat.db" }),'
    );
  });

  it("renders env schema for provided variables", () => {
    const result = renderEnvSchemaFile([
      {
        key: "OPENAI_API_KEY",
        description: "OpenAI API key",
        category: "provider",
      },
      {
        key: "DISCORD_BOT_TOKEN",
        description: "Discord bot token",
        category: "platform",
      },
    ]);

    expect(result).toContain("OPENAI_API_KEY");
    expect(result).toContain("DISCORD_BOT_TOKEN");
  });

  it("creates core project files", () => {
    const files = createProjectFiles({
      projectName: "goodchat-app",
      config: {
        databaseDialect: "sqlite",
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["local"],
        withDashboard: true,
        isServerless: false,
      },
      envMetadata: [
        {
          key: "OPENAI_API_KEY",
          description: "OpenAI API key",
          category: "provider",
        },
      ],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("src/goodchat.ts");
    expect(filePaths).toContain("src/index.ts");
    expect(filePaths).toContain("src/env.ts");
    expect(filePaths).toContain(".env");
    expect(filePaths).not.toContain("src/db/schema.ts");
    expect(filePaths).not.toContain("src/db/auth-schema.ts");
    expect(filePaths).not.toContain("src/db/plugins/schema.ts");
    expect(filePaths).not.toContain("drizzle.config.ts");
    expect(filePaths).not.toContain("src/app.ts");
  });

  it("renders package scripts for lifecycle schema sync", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "sqlite",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.dependencies["@goodchat/cli"]).toBeDefined();
    expect(packageJson.scripts["db:schema:sync"]).toBe(
      "goodchat db schema sync"
    );
    expect(packageJson.scripts["db:schema:check"]).toBe(
      "goodchat db schema sync --check"
    );
  });

  it("renders goodchat runtime file with dialect and bot metadata", () => {
    const configFile = renderGoodchatFile({
      databaseDialect: "postgres",
      id: "test-id",
      isServerless: false,
      model: "openai/gpt-4.1-mini",
      name: "Test Bot",
      platforms: ["local", "discord"],
      plugins: ["linear"],
      prompt: "Be precise",
      withDashboard: true,
      mcp: [],
    });

    expect(configFile).toContain("export const goodchat = {");
    expect(configFile).toContain(
      'database: postgres({ connectionString: process.env.DATABASE_URL || "" }),'
    );
    expect(configFile).toContain('name: "Test Bot"');
    expect(configFile).toContain("plugins: [linear]");
  });
});
