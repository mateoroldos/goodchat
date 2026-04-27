import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
import { describe, expect, it } from "vitest";
import {
  buildDatabaseExpression,
  buildImports,
  renderGoodchatFile,
} from "./runtime";

describe("runtime renderer", () => {
  it("renders runtime config with plugins, mcp, and auth password", () => {
    const result = renderGoodchatFile({
      authEnabled: true,
      databaseDialect: "sqlite",
      name: "Support Bot",
      prompt: "Be helpful",
      platforms: ["web", "slack"],
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
      plugins: ["linear"],
      mcp: [
        {
          name: "notion",
          transport: { type: "http", url: "https://mcp.notion" },
        },
      ],
    });

    expect(result).toContain('name: "Support Bot"');
    expect(result).toContain('prompt: "Be helpful"');
    expect(result).toContain("plugins: [linear]");
    expect(result).toContain('enabled: env.ENVIRONMENT !== "development"');
    expect(result).toContain("password: env.GOODCHAT_DASHBOARD_PASSWORD");
    expect(result).toContain("mcp:");
    expect(result).toContain("https://mcp.notion");
    expect(result).toContain(
      "database: sqlite({ path: env.DATABASE_URL, schema }),"
    );
  });

  it("renders auth disabled block without password", () => {
    const result = renderGoodchatFile({
      authEnabled: false,
      databaseDialect: "sqlite",
      name: "No Auth Bot",
      prompt: "Be helpful",
      platforms: ["web"],
    });

    expect(result).toContain("auth: {");
    expect(result).toContain("enabled: false");
    expect(result).not.toContain("password: env.GOODCHAT_DASHBOARD_PASSWORD");
  });

  it("renders dialect-specific database expressions", () => {
    expect(
      buildDatabaseExpression({
        authEnabled: true,
        databaseDialect: "postgres",
        name: "Postgres",
        prompt: "x",
        platforms: ["web"],
      })
    ).toContain("postgres({ connectionString: env.DATABASE_URL, schema })");

    expect(
      buildDatabaseExpression({
        authEnabled: true,
        databaseDialect: "postgres",
        databaseProfileId: "postgres-neon",
        name: "Neon",
        prompt: "x",
        platforms: ["web"],
      })
    ).toContain('driver: "@neondatabase/serverless"');

    expect(
      buildDatabaseExpression({
        authEnabled: true,
        databaseDialect: "mysql",
        databaseProfileId: "mysql-planetscale",
        name: "PlanetScale",
        prompt: "x",
        platforms: ["web"],
      })
    ).toContain('mode: "planetscale"');
  });

  it.each<{
    dialect: "sqlite" | "postgres" | "mysql";
    expectedImport: string;
  }>([
    {
      dialect: "sqlite",
      expectedImport: 'import { sqlite } from "@goodchat/storage/sqlite";',
    },
    {
      dialect: "postgres",
      expectedImport: 'import { postgres } from "@goodchat/storage/postgres";',
    },
    {
      dialect: "mysql",
      expectedImport: 'import { mysql } from "@goodchat/storage/mysql";',
    },
  ])("renders storage import for $dialect", ({ dialect, expectedImport }) => {
    const imports = buildImports({
      authEnabled: true,
      databaseDialect: dialect,
      name: "Bot",
      prompt: "x",
      platforms: ["web"],
      plugins: ["linear"],
      model: { provider: "openai", modelId: "gpt-4.1-mini" },
    });

    expect(imports).toContain(expectedImport);
    expect(imports).toContain(
      'import { linear } from "@goodchat/plugins/linear";'
    );
  });

  it("renders Node ESM-safe relative imports when enabled", () => {
    const output = renderGoodchatFile(
      {
        authEnabled: true,
        databaseDialect: "postgres",
        name: "Node Bot",
        prompt: "Be helpful",
        platforms: ["web"],
      },
      true,
      true
    );

    expect(output).toContain('import { schema } from "./db/schema.js";');
    expect(output).toContain('import { env } from "./env.js";');
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
  ])("renders model factory import and model call for $provider", ({
    provider,
    modelId,
    expectedFactory,
  }) => {
    const output = renderGoodchatFile({
      authEnabled: false,
      databaseDialect: "sqlite",
      model: { provider, modelId },
      name: "Provider Bot",
      platforms: ["web"],
      prompt: "Be helpful",
    });

    expect(output).toContain(`model: ${expectedFactory}("${modelId}")`);
    expect(output).toContain(expectedFactory);
    expect(output).toContain("createGoodchat");
  });
});
