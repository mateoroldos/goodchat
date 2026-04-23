import { describe, expect, it, vi } from "vitest";
import type { EnvVariableMeta } from "../env-metadata";
import { renderEnvFile, renderEnvSchemaFile } from "./env";

describe("env renderers", () => {
  it("renders env schema entries with explicit and fallback schema", () => {
    const result = renderEnvSchemaFile([
      {
        key: "OPENAI_API_KEY",
        description: "OpenAI API key",
        category: "provider",
        schema: 'z.string().min(1, "OpenAI key is required")',
      },
      {
        key: "DISCORD_BOT_TOKEN",
        description: "Discord bot token",
        category: "platform",
      },
    ]);

    expect(result).toContain("OPENAI_API_KEY: z.string().min(1");
    expect(result).toContain("DISCORD_BOT_TOKEN: z.string().optional()");
    expect(result).toContain("runtimeEnv: process.env");
  });

  it("renders env file with categories, docs links, and platform spacing", () => {
    const metadata: EnvVariableMeta[] = [
      {
        key: "DATABASE_URL",
        description: "Database URL",
        category: "core",
      },
      {
        key: "OPENAI_API_KEY",
        description: "OpenAI key",
        category: "provider",
        docsUrl: "https://platform.openai.com/api-keys",
      },
      {
        key: "DISCORD_BOT_TOKEN",
        description: "Discord token",
        category: "platform",
        platforms: ["discord"],
      },
      {
        key: "SLACK_BOT_TOKEN",
        description: "Slack token",
        category: "platform",
        platforms: ["slack"],
      },
    ];

    const content = renderEnvFile(metadata, () => "unused-secret");

    expect(content).toContain("# Core");
    expect(content).toContain("# Provider");
    expect(content).toContain("# Platform");
    expect(content).toContain("# Docs: https://platform.openai.com/api-keys");
    expect(content).toContain('DATABASE_URL=""');
    expect(content).toContain('DISCORD_BOT_TOKEN=""\n\n# Slack token');
  });

  it("uses secret factory for auth and cron secrets when unset", () => {
    const metadata: EnvVariableMeta[] = [
      {
        key: "GOODCHAT_AUTH_SECRET",
        description: "Auth secret",
        category: "core",
      },
      {
        key: "CRON_SECRET",
        description: "Cron secret",
        category: "core",
      },
    ];
    const secretFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce("auth-secret")
      .mockReturnValueOnce("cron-secret");

    const content = renderEnvFile(metadata, secretFactory);

    expect(secretFactory).toHaveBeenCalledTimes(2);
    expect(content).toContain('GOODCHAT_AUTH_SECRET="auth-secret"');
    expect(content).toContain('CRON_SECRET="cron-secret"');
  });

  it("keeps explicit secret default values", () => {
    const metadata: EnvVariableMeta[] = [
      {
        key: "GOODCHAT_AUTH_SECRET",
        description: "Auth secret",
        category: "core",
        defaultValue: "explicit-auth",
      },
      {
        key: "CRON_SECRET",
        description: "Cron secret",
        category: "core",
        defaultValue: "explicit-cron",
      },
    ];
    const secretFactory = vi.fn<() => string>().mockReturnValue("generated");

    const content = renderEnvFile(metadata, secretFactory);

    expect(secretFactory).not.toHaveBeenCalled();
    expect(content).toContain('GOODCHAT_AUTH_SECRET="explicit-auth"');
    expect(content).toContain('CRON_SECRET="explicit-cron"');
  });
});
