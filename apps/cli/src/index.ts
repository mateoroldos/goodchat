import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  cancel,
  confirm,
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

// ── Primary color ─────────────────────────────────────────────────────────-
// oklch(0.78 0.185 70) ≈ rgb(255, 163, 10)
const FG_AMB = "\x1b[38;2;255;163;10m";
const RST = "\x1b[0m";

const printBanner = (): void => {
  process.stdout.write(`\n${FG_AMB}Welcome to goodchat${RST}\n\n`);
};

const run = async (): Promise<void> => {
  await printBanner();

  const botName = handleCancel(
    await text({
      message: "Bot name",
      placeholder: "Walter",
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const projectName = deriveBotId(botName);

  const targetDirInput = handleCancel(
    await text({
      message: "Target directory",
      initialValue: `./${projectName}`,
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

  const targetDir = resolve(process.cwd(), targetDirInput);
  await ensureEmptyDir(targetDir);

  const prompt = handleCancel(
    await text({
      message: "Bot prompt",
      placeholder: "You are a helpful assistant",
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
    })
  );

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
      message: "Include bot website?",
      initialValue: true,
    })
  );

  const isServerless = false;
  const id = undefined;

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
    mcp: mcp.length > 0 ? mcp : undefined,
  };

  const envVariables = getEnvVariables({
    platforms: platforms as Platform[],
    plugins,
  });

  const files = createProjectFiles({
    projectName,
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
