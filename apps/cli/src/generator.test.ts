import { describe, expect, it } from "vitest";
import {
  createProjectFiles,
  getEnvVariables,
  type ProjectFile,
  renderAppFile,
  renderEnvSchemaFile,
} from "./generator";

describe("generator helpers", () => {
  it("includes platform and plugin env keys", () => {
    const variables = getEnvVariables({
      platforms: ["local", "discord"],
      plugins: ["linear"],
    });

    expect(variables[0]).toBe("OPENAI_API_KEY");
    expect(variables).toContain("DISCORD_BOT_TOKEN");
    expect(variables).toContain("DISCORD_PUBLIC_KEY");
    expect(variables).toContain("DISCORD_APPLICATION_ID");
    expect(variables).toContain("LINEAR_API_TOKEN");
  });

  it("renders app config with plugins and mcp", () => {
    const result = renderAppFile({
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
  });

  it("renders env schema for provided variables", () => {
    const result = renderEnvSchemaFile(["OPENAI_API_KEY", "DISCORD_BOT_TOKEN"]);

    expect(result).toContain("OPENAI_API_KEY");
    expect(result).toContain("DISCORD_BOT_TOKEN");
  });

  it("creates core project files", () => {
    const files = createProjectFiles({
      projectName: "goodchat-app",
      config: {
        name: "goodchat",
        prompt: "Be helpful",
        platforms: ["local"],
        withDashboard: true,
        isServerless: false,
      },
      envVariables: ["OPENAI_API_KEY"],
    });

    const filePaths = files.map((file: ProjectFile) => file.path);
    expect(filePaths).toContain("package.json");
    expect(filePaths).toContain("src/app.ts");
    expect(filePaths).toContain("src/index.ts");
    expect(filePaths).toContain("src/env.ts");
    expect(filePaths).toContain(".env");
  });
});
