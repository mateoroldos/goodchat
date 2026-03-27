import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import {
  createProjectFiles,
  type GeneratorConfig,
  getEnvVariables,
  type McpServerConfig,
  type Platform,
} from "./generator";

const LLM_MODEL_ID_REGEX = /^[a-z0-9-]+\/[\w.-]+$/i;
const MODEL_OPTIONS = [
  {
    label: "OpenAI GPT-4.1 Mini",
    value: "openai/gpt-4.1-mini",
  },
  {
    label: "OpenAI GPT-4.1",
    value: "openai/gpt-4.1",
  },
  {
    label: "Anthropic Claude Sonnet 4.6",
    value: "anthropic/claude-sonnet-4.6",
  },
  {
    label: "Google Gemini 2.5 Flash",
    value: "google/gemini-2.5-flash",
  },
  {
    label: "Google Gemini 2.5 Pro",
    value: "google/gemini-2.5-pro",
  },
  {
    label: "Custom (enter provider/model)",
    value: "custom",
  },
  {
    label: "Use default (openai/gpt-4.1-nano)",
    value: "default",
  },
];

const handleCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
  return value as T;
};

const ensureEmptyDir = async (targetDir: string): Promise<void> => {
  try {
    const stats = await stat(targetDir);
    if (!stats.isDirectory()) {
      throw new Error("Target path exists and is not a directory");
    }
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw new Error("Target directory is not empty");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to inspect target directory");
  }
};

const writeFiles = async (
  targetDir: string,
  files: { path: string; content: string }[]
): Promise<void> => {
  for (const file of files) {
    const filePath = join(targetDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf8");
  }
};

const promptMcpServers = async (): Promise<McpServerConfig[]> => {
  const servers: McpServerConfig[] = [];
  let shouldAdd = handleCancel(
    await confirm({
      message: "Add an MCP server?",
      initialValue: false,
    })
  );

  while (shouldAdd) {
    const name = handleCancel(
      await text({
        message: "MCP server name",
        validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
      })
    );

    const transportType = handleCancel(
      await select({
        message: "MCP transport",
        options: [
          { label: "HTTP", value: "http" },
          { label: "SSE", value: "sse" },
          { label: "Stdio", value: "stdio" },
        ],
      })
    );

    if (transportType === "http" || transportType === "sse") {
      const url = handleCancel(
        await text({
          message: "MCP URL",
          validate: (value) =>
            value.trim().length > 0 ? undefined : "Required",
        })
      );

      const includeHeaders = handleCancel(
        await confirm({
          message: "Add headers (JSON)?",
          initialValue: false,
        })
      );

      let headers: Record<string, string> | undefined;
      if (includeHeaders) {
        const headerText = handleCancel(
          await text({
            message: "Headers JSON",
            placeholder: '{"Authorization":"Bearer ..."}',
            validate: (value) => {
              if (!value.trim()) {
                return "Required";
              }
              try {
                const parsed = JSON.parse(value) as unknown;
                if (!parsed || typeof parsed !== "object") {
                  return "Must be a JSON object";
                }
                return undefined;
              } catch {
                return "Invalid JSON";
              }
            },
          })
        );

        headers = JSON.parse(headerText) as Record<string, string>;
      }

      servers.push({
        name,
        transport: {
          type: transportType,
          url,
          headers,
        },
      });
    } else {
      const command = handleCancel(
        await text({
          message: "MCP command",
          validate: (value) =>
            value.trim().length > 0 ? undefined : "Required",
        })
      );

      const argsText = handleCancel(
        await text({
          message: "Command args (comma-separated)",
          placeholder: "--foo,bar",
        })
      );

      const includeEnv = handleCancel(
        await confirm({
          message: "Add env (JSON)?",
          initialValue: false,
        })
      );

      let env: Record<string, string> | undefined;
      if (includeEnv) {
        const envText = handleCancel(
          await text({
            message: "Env JSON",
            placeholder: '{"KEY":"value"}',
            validate: (value) => {
              if (!value.trim()) {
                return "Required";
              }
              try {
                const parsed = JSON.parse(value) as unknown;
                if (!parsed || typeof parsed !== "object") {
                  return "Must be a JSON object";
                }
                return undefined;
              } catch {
                return "Invalid JSON";
              }
            },
          })
        );

        env = JSON.parse(envText) as Record<string, string>;
      }

      const args = argsText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      servers.push({
        name,
        transport: {
          type: "stdio",
          command,
          args: args.length > 0 ? args : undefined,
          env,
        },
      });
    }

    shouldAdd = handleCancel(
      await confirm({
        message: "Add another MCP server?",
        initialValue: false,
      })
    );
  }

  return servers;
};

const run = async (): Promise<void> => {
  intro("Goodchat generator");

  const projectName = handleCancel(
    await text({
      message: "Project name",
      initialValue: "goodchat-app",
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const targetDirInput = handleCancel(
    await text({
      message: "Target directory",
      initialValue: `./${deriveBotId(projectName)}`,
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const targetDir = resolve(process.cwd(), targetDirInput);
  await ensureEmptyDir(targetDir);

  const botName = handleCancel(
    await text({
      message: "Bot name",
      initialValue: projectName,
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const prompt = handleCancel(
    await text({
      message: "Bot prompt",
      placeholder: "You are a helpful assistant",
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const modelSelection = handleCancel(
    await select({
      message: "Select model (provider/model)",
      options: MODEL_OPTIONS,
      initialValue: "default",
    })
  );

  let modelId: string | undefined;
  if (modelSelection === "custom") {
    modelId = handleCancel(
      await text({
        message: "Model id (provider/model)",
        placeholder: "openai/gpt-4.1-nano",
        validate: (value) =>
          LLM_MODEL_ID_REGEX.test(value.trim())
            ? undefined
            : "Use provider/model format",
      })
    );
  } else if (modelSelection !== "default") {
    modelId = modelSelection as string;
  }

  const platforms = handleCancel(
    await multiselect({
      message: "Select platforms",
      options: CHAT_PLATFORMS.map((platform) => ({
        value: platform,
        label: platform,
      })),
      initialValues: ["local"],
      required: true,
    })
  );

  const withDashboard = handleCancel(
    await confirm({
      message: "Include the dashboard?",
      initialValue: true,
    })
  );

  const isServerless = handleCancel(
    await confirm({
      message: "Serverless runtime?",
      initialValue: false,
    })
  );

  const wantsCustomId = handleCancel(
    await confirm({
      message: "Set a custom bot id?",
      initialValue: false,
    })
  );

  let id: string | undefined;
  if (wantsCustomId) {
    id = handleCancel(
      await text({
        message: "Bot id",
        initialValue: deriveBotId(botName),
        validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
      })
    );
  }

  const plugins = handleCancel(
    await multiselect({
      message: "Select plugins",
      options: [{ label: "Linear", value: "linear" }],
      required: false,
    })
  );

  const mcp = await promptMcpServers();

  const config: GeneratorConfig = {
    name: botName,
    prompt,
    platforms: platforms as Platform[],
    withDashboard,
    isServerless,
    id,
    plugins,
    modelId,
    mcp: mcp.length > 0 ? mcp : undefined,
  };

  const envVariables = getEnvVariables({
    platforms: platforms as Platform[],
    plugins,
  });

  const files = createProjectFiles({
    projectName: deriveBotId(projectName),
    config,
    envVariables,
  });

  const writer = spinner();
  writer.start("Creating project files");
  await writeFiles(targetDir, files);
  writer.stop("Project created");

  outro(`Done. Next:\n  cd ${targetDirInput}\n  bun install\n  bun run dev`);
};

await run();
