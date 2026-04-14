import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
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
      authEnabled: true,
      platforms: ["local", "discord"],
      plugins: ["linear"],
    }).map((meta) => meta.key);

    expect(variables).toContain("DISCORD_BOT_TOKEN");
    expect(variables).toContain("DISCORD_PUBLIC_KEY");
    expect(variables).toContain("DISCORD_APPLICATION_ID");
    expect(variables).toContain("GOODCHAT_DASHBOARD_PASSWORD");
    expect(variables).toContain("GOODCHAT_AUTH_SECRET");
  });

  it("renders goodchat runtime file with plugins and mcp", () => {
    const result = renderGoodchatFile({
      authEnabled: true,
      databaseDialect: "sqlite",
      name: "Support Bot",
      prompt: "Be helpful",
      platforms: ["local", "slack"],
      withDashboard: true,
      isServerless: false,
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
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
    expect(result).toContain("export const goodchat = createGoodchat({");
    expect(result).toContain('import { schema } from "./db/schema";');
    expect(result).toContain("auth: {");
    expect(result).toContain("enabled: true,");
    expect(result).toContain(
      "password: process.env.GOODCHAT_DASHBOARD_PASSWORD,"
    );
    expect(result).toContain(
      'database: sqlite({ path: process.env.DATABASE_URL || "./goodchat.db", schema }),'
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

  it("renders docs URLs in scaffolded env file comments", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
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
          docsUrl: "https://platform.openai.com/api-keys",
        },
      ],
    });

    const envFile = files.find((file) => file.path === ".env");
    expect(envFile?.content).toContain(
      "# Docs: https://platform.openai.com/api-keys"
    );
  });

  it("creates core project files", async () => {
    const files = await createProjectFiles({
      projectName: "goodchat-app",
      config: {
        authEnabled: true,
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
        {
          key: "GOODCHAT_DASHBOARD_PASSWORD",
          description: "Dashboard password",
          category: "core",
          requiresAuth: true,
        },
      ],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
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
    expect(filePaths).not.toContain("src/app.ts");

    const sqliteMigrateFile = files.find(
      (file) => file.path === "src/db/migrate.ts"
    );
    expect(sqliteMigrateFile?.content).toContain(
      "SQLite migrations applied successfully."
    );
  });

  it("renders package scripts for lifecycle schema sync", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "sqlite",
        dependencyChannel: "latest",
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
    expect(packageJson.scripts["db:migrate"]).toBe("bun run src/db/migrate.ts");
  });

  it("renders drizzle-kit migrate script for non-sqlite dialects", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "postgres",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["db:migrate"]).toBe(
      "drizzle-kit migrate --config=drizzle.config.ts"
    );
  });

  it("renders package dependencies from next channel", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "sqlite",
        dependencyChannel: "next",
        projectName: "goodchat-app",
        usesPlugins: true,
      })
    ) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@goodchat/cli"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/core"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/adapter-sqlite"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/plugins"]).toBe("next");
  });

  it("renders goodchat runtime file with dialect and bot metadata", () => {
    const configFile = renderGoodchatFile({
      authEnabled: true,
      databaseDialect: "postgres",
      id: "test-id",
      isServerless: false,
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      name: "Test Bot",
      platforms: ["local", "discord"],
      plugins: ["linear"],
      prompt: "Be precise",
      withDashboard: true,
      mcp: [],
    });

    expect(configFile).toContain("export const goodchat = createGoodchat({");
    expect(configFile).toContain(
      'database: postgres({ connectionString: process.env.DATABASE_URL || "", schema }),'
    );
    expect(configFile).toContain('name: "Test Bot"');
    expect(configFile).toContain("plugins: [linear]");
  });

  it.each<{
    provider: ModelProvider;
    modelId: string;
    expectedFactory: string;
  }>([
    {
      provider: "openai",
      modelId: "gpt-4.1-mini",
      expectedFactory: "openai",
    },
    {
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      expectedFactory: "anthropic",
    },
    {
      provider: "google",
      modelId: "gemini-2.5-flash",
      expectedFactory: "google",
    },
    {
      provider: "openrouter",
      modelId: "openai/gpt-4.1-mini",
      expectedFactory: "openrouter",
    },
    {
      provider: "ai-gateway",
      modelId: "@cf/meta/llama-3.1-8b-instruct",
      expectedFactory: "aiGateway",
    },
    {
      provider: "vercel-gateway",
      modelId: "openai/gpt-4.1-mini",
      expectedFactory: "vercelGateway",
    },
  ])("renders model factory import for $provider", ({
    provider,
    modelId,
    expectedFactory,
  }) => {
    const output = renderGoodchatFile({
      authEnabled: false,
      databaseDialect: "sqlite",
      isServerless: false,
      model: { provider, modelId },
      name: "Provider Bot",
      platforms: ["local"],
      prompt: "Be helpful",
      withDashboard: false,
    });

    expect(output).toContain(
      `import { createGoodchat, ${expectedFactory} } from "@goodchat/core";`
    );
    expect(output).toContain(`model: ${expectedFactory}("${modelId}")`);
  });
});
