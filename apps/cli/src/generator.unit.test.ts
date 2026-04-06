import { describe, expect, it } from "vitest";
import {
  createProjectFiles,
  getEnvMetadataForConfig,
  type ProjectFile,
  renderAppFile,
  renderDrizzleConfigFile,
  renderDrizzleSchemaFile,
  renderEnvSchemaFile,
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

  it("renders app config with plugins and mcp", () => {
    const result = renderAppFile({
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
    expect(result).toContain('model: "openai/gpt-4.1-mini"');
    expect(result).toContain(
      "database: sqlite({ path: process.env.DATABASE_URL"
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
    expect(filePaths).toContain("src/app.ts");
    expect(filePaths).toContain("src/index.ts");
    expect(filePaths).toContain("src/env.ts");
    expect(filePaths).toContain("src/db/schema.ts");
    expect(filePaths).toContain("drizzle.config.ts");
    expect(filePaths).toContain(".env");

    const copiedSchemaFile = files.find(
      (file) => file.path === "src/db/schema.ts"
    );
    expect(copiedSchemaFile?.content).toContain(
      'import { sqliteTable, text } from "drizzle-orm/sqlite-core";'
    );
  });

  it("renders drizzle schema with top-level table exports", () => {
    const result = renderDrizzleSchemaFile("postgres");

    expect(result).toContain(
      'import { jsonb, pgTable, text } from "drizzle-orm/pg-core";'
    );
    expect(result).toContain(
      'export const threads = pgTable("goodchat_threads"'
    );
    expect(result).toContain(
      'export const messages = pgTable("goodchat_messages"'
    );
    expect(result).toContain(
      'export const goodchatMeta = pgTable("goodchat_meta"'
    );
  });

  it("renders single-file drizzle config", () => {
    const result = renderDrizzleConfigFile("sqlite");

    expect(result).toContain('schema: "./src/db/schema.ts"');
    expect(result).toContain('dialect: "sqlite"');
    expect(result).toContain(
      'url: process.env.DATABASE_URL || "./goodchat.db"'
    );
  });
});
