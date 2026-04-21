import { spawn } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { styleText } from "node:util";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  password,
  S_BAR,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type {
  DatabaseDialect,
  Platform,
} from "@goodchat/contracts/config/types";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import {
  MODEL_CATALOG,
  MODEL_PROVIDER_OPTIONS,
  MODEL_PROVIDER_PROMPT_DOCS_URL,
  MODEL_PROVIDER_PROMPT_ENV_KEY,
} from "@goodchat/contracts/model/provider-metadata";
import { PLATFORM_METADATA } from "@goodchat/contracts/platform/platform-metadata";
import type { Provider } from "./env-metadata";
import {
  createProjectFiles,
  getEnvMetadataForConfig,
  type ScaffolderConfig,
  type SelectedModel,
} from "./generator";
import {
  DEPENDENCY_CHANNELS,
  type DependencyChannel,
  resolveDefaultDependencyChannel,
} from "./version-manifest";

const handleCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    process.exit(0);
  }
  return value as T;
};

const ensureEmptyDirValidation = (
  value: string | undefined
): string | undefined => {
  const required = validateRequired(value);
  if (required) {
    return required;
  }

  const inputValue = value?.trim();
  if (!inputValue) {
    return "Required";
  }

  const targetDir = resolve(process.cwd(), inputValue);

  try {
    const stats = statSync(targetDir);
    if (!stats.isDirectory()) {
      return "Target path exists and is not a directory";
    }
    const entries = readdirSync(targetDir);
    if (entries.length > 0) {
      return "Target directory is not empty";
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "Failed to inspect target directory";
  }

  return undefined;
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

const runCommand = async (
  targetDir: string,
  command: string,
  args: string[]
): Promise<void> => {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: targetDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      const message =
        output.trim() ||
        `${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`;
      rejectPromise(new Error(message));
    });
  });
};

// ── Primary color ─────────────────────────────────────────────────────────-
// oklch(0.78 0.185 70) ≈ rgb(255, 163, 10)
const FG_INK = "\x1b[38;2;16;16;16m";
const FG_MUTED = "\x1b[38;2;190;190;190m";
const FG_SOFT = "\x1b[38;2;220;220;220m";
const BG_AMB = "\x1b[48;2;255;163;10m";
const BG_SOFT = "\x1b[48;2;52;52;52m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const printBanner = (): void => {
  process.stdout.write("\n");
  intro(`${BG_AMB}${FG_INK}${BOLD} goodchat ${RST}`, { withGuide: true });
};

const renderPromptMessage = (title: string, helperLines: string[]): string => {
  if (helperLines.length === 0) {
    return title;
  }
  const helperPrefix = `${styleText("gray", S_BAR)}  `;
  const helperRows = helperLines.map(
    (line) => `${helperPrefix}${DIM}${line}${RST}`
  );
  return [title, ...helperRows].join("\n");
};

const BOT_NAME_OPTIONS = [
  "Mateo",
  "Martin",
  "Bruno",
  "Juan",
  "Nico",
  "Pablo",
  "Carlos",
  "Luis",
  "Pedro",
  "Santi",
  "Rambo",
  "Felipe",
  "Patricio",
] as const;

const pickBotNamePlaceholder = (): string => {
  const index = Math.floor(Math.random() * BOT_NAME_OPTIONS.length);
  return BOT_NAME_OPTIONS[index] ?? "Mateo";
};

const PROMPT_PLACEHOLDER_OPTIONS = [
  "You are a startup CEO: pivot weekly, monetize everything, call panic vision.",
  "You are a tech lead: reject rewrites publicly, plan them privately.",
  "You are a senior engineer: approve late, critique early, touch nothing legacy.",
  "You are an architect: diagram confidence, deploy uncertainty.",
  "You are a product engineer: ship value, then survive scope updates.",
  "You are a staff engineer: strategic in meetings, invisible in tickets.",
  "You are a CTO: mostly political, occasionally technical, always certain.",
  "You are an elite debugger: find root cause, watch hotfix win anyway.",
  "You are a principal engineer: predicted this outage in last quarter's RFC.",
  "You are an SRE: blamed for incidents you warned about.",
  "You are a strict reviewer: reject with standards, approve with deadlines.",
  "You are a friendly skeptic: kill bad ideas gently, claim good ones later.",
  "You are an engineering manager: shield chaos, schedule more chaos.",
  "You are a blunt consultant: expensive advice, familiar conclusions.",
  "You are a calm operator: reassuring voice, catastrophic internal monologue.",
  "You are a maintainer: write clean code others patch on Friday.",
  "You are a clarity-first engineer: simplify today, re-complicate tomorrow.",
] as const;

const pickPromptPlaceholder = (): string => {
  const index = Math.floor(Math.random() * PROMPT_PLACEHOLDER_OPTIONS.length);
  return (
    PROMPT_PLACEHOLDER_OPTIONS[index] ??
    "You are a helpful assistant with clear, practical answers."
  );
};

const validateRequired = (value: string | undefined): string | undefined =>
  value?.trim().length ? undefined : "Required";

const renderSectionBadge = (label: string): string =>
  `${BG_SOFT}${FG_SOFT} ${label} ${RST}`;

const stripAnsi = (value: string): string =>
  value
    .replaceAll(BG_SOFT, "")
    .replaceAll(FG_SOFT, "")
    .replaceAll(FG_MUTED, "")
    .replaceAll(BG_AMB, "")
    .replaceAll(FG_INK, "")
    .replaceAll(DIM, "")
    .replaceAll(RST, "");

const visibleLength = (value: string): number => stripAnsi(value).length;

const padVisible = (value: string, width: number): string => {
  const remaining = width - visibleLength(value);
  return remaining > 0 ? `${value}${" ".repeat(remaining)}` : value;
};

const renderCard = (title: string, lines: string[]): string => {
  const width = Math.max(visibleLength(title), ...lines.map(visibleLength));
  const border = `┌${"─".repeat(width + 2)}┐`;
  const footer = `└${"─".repeat(width + 2)}┘`;
  const rows = lines.map((line) => `│ ${padVisible(line, width)} │`);
  if (title.trim().length === 0) {
    return [border, ...rows, footer].join("\n");
  }
  const titleRow = `│ ${padVisible(title, width)} │`;
  return [border, titleRow, ...rows, footer].join("\n");
};

const SETUP_COMMAND_LABELS = {
  install: "bun install",
  generate: "bun run db:generate",
  migrate: "bun run db:migrate",
} as const;

const runOptionalSetup = async (
  targetDir: string
): Promise<{
  completedSetupCommands: Set<string>;
  setupErrorMessage: string | undefined;
}> => {
  const completedSetupCommands = new Set<string>();
  let setupErrorMessage: string | undefined;

  const shouldRunSetupNow = handleCancel(
    await confirm({
      message: "Install dependencies and run database setup now?",
      initialValue: true,
      withGuide: true,
    })
  );

  if (!shouldRunSetupNow) {
    return { completedSetupCommands, setupErrorMessage };
  }

  const setupSteps: {
    key: keyof typeof SETUP_COMMAND_LABELS;
    title: string;
    done: string;
    args: string[];
  }[] = [
    {
      key: "install",
      title: "Installing dependencies",
      done: "Dependencies installed",
      args: ["install"],
    },
    {
      key: "generate",
      title: "Generating database schema",
      done: "Database schema generated",
      args: ["run", "db:generate"],
    },
    {
      key: "migrate",
      title: "Running database migrations",
      done: "Database migrations completed",
      args: ["run", "db:migrate"],
    },
  ];

  for (const step of setupSteps) {
    const stepSpinner = spinner({ withGuide: true });
    stepSpinner.start(step.title);

    try {
      await runCommand(targetDir, "bun", step.args);
      completedSetupCommands.add(SETUP_COMMAND_LABELS[step.key]);
      stepSpinner.stop(step.done);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown setup error while running bun commands.";
      setupErrorMessage = `Automatic setup failed at \`${SETUP_COMMAND_LABELS[step.key]}\`: ${message}`;
      stepSpinner.error(`Failed: ${SETUP_COMMAND_LABELS[step.key]}`);
      break;
    }
  }

  return { completedSetupCommands, setupErrorMessage };
};

const buildNextStepCommands = (
  targetDirInput: string,
  completedSetupCommands: ReadonlySet<string>
): string[] => {
  const nextStepCommands = [
    `1) cd ${targetDirInput}`,
    ...[
      SETUP_COMMAND_LABELS.install,
      SETUP_COMMAND_LABELS.generate,
      SETUP_COMMAND_LABELS.migrate,
    ]
      .filter((command) => !completedSetupCommands.has(command))
      .map((command, index) => `${index + 2}) ${command}`),
  ];
  nextStepCommands.push(`${nextStepCommands.length + 1}) bun run dev`);
  return nextStepCommands;
};

const handleLifecycleCommandAttempt = (args: string[]): void => {
  if (args.length === 0) {
    return;
  }

  const lifecycleTopLevelCommands = new Set([
    "auth",
    "build",
    "db",
    "deploy",
    "dev",
    "doctor",
    "plugins",
    "start",
    "threads",
  ]);

  const firstArg = args[0] as string;
  if (!lifecycleTopLevelCommands.has(firstArg)) {
    return;
  }

  const command = args.join(" ");
  throw new Error(
    [
      "create-goodchat only supports project scaffolding.",
      `Received lifecycle command: ${command}`,
      `Use the lifecycle CLI instead: goodchat ${command}`,
    ].join("\n")
  );
};

const parseDependencyChannelArg = (
  args: string[]
): DependencyChannel | null => {
  for (const [index, arg] of args.entries()) {
    if (arg === "--channel") {
      const nextArg = args[index + 1];
      if (!nextArg) {
        throw new Error("Missing value for --channel. Use latest or next.");
      }

      if (DEPENDENCY_CHANNELS.includes(nextArg as DependencyChannel)) {
        return nextArg as DependencyChannel;
      }

      throw new Error(
        `Invalid --channel value: ${nextArg}. Use latest or next.`
      );
    }

    if (!arg.startsWith("--channel=")) {
      continue;
    }

    const value = arg.slice("--channel=".length);
    if (DEPENDENCY_CHANNELS.includes(value as DependencyChannel)) {
      return value as DependencyChannel;
    }

    throw new Error(`Invalid --channel value: ${value}. Use latest or next.`);
  }

  return null;
};

const promptModel = async (): Promise<{
  model: SelectedModel;
  provider: Provider;
  apiKeyEnvKey: string | undefined;
  apiKeyDocsUrl: string | undefined;
  apiKey: string | undefined;
}> => {
  const providerSelection = handleCancel(
    await select({
      message: "AI provider",
      options: MODEL_PROVIDER_OPTIONS,
      initialValue: "openai",
    })
  );

  const provider = providerSelection as Provider;
  const knownModels = MODEL_CATALOG[provider] ?? [];
  const modelSelection = handleCancel(
    await select({
      message: "Model",
      options: [
        ...knownModels.map((id) => ({ label: id, value: id })),
        { label: "Custom model ID", value: "__custom__" },
      ],
    })
  );

  let modelId: string;
  if (modelSelection === "__custom__") {
    modelId = handleCancel(
      await text({
        message: "Model ID",
        validate: validateRequired,
      })
    );
  } else {
    modelId = modelSelection;
  }

  const apiKeyEnvKey = MODEL_PROVIDER_PROMPT_ENV_KEY[provider];
  const apiKeyDocsUrl = MODEL_PROVIDER_PROMPT_DOCS_URL[provider];
  const apiKey = apiKeyEnvKey
    ? handleCancel(
        await password({
          message: renderPromptMessage(apiKeyEnvKey, [
            ...(apiKeyDocsUrl ? [`Get key: ${apiKeyDocsUrl}`] : []),
            "Press Enter to skip for now.",
          ]),
        })
      )
    : undefined;

  return {
    model: { provider, modelId },
    provider,
    apiKeyEnvKey,
    apiKeyDocsUrl,
    apiKey,
  };
};

const promptPlatformEnvVars = async (
  selectedPlatforms: Platform[]
): Promise<{
  defaults: Map<string, string>;
  skippedRequiredKeys: Set<string>;
}> => {
  const collected = new Map<string, string>();
  const skippedRequiredKeys = new Set<string>();
  for (const platform of selectedPlatforms) {
    if (platform === "web") {
      continue;
    }
    const { envVariables, label } = PLATFORM_METADATA[platform];
    const requiredVariables = envVariables.filter(
      (variable) => variable.required
    );
    for (const variable of requiredVariables) {
      const value = handleCancel(
        await password({
          message: renderPromptMessage(`[${label}] ${variable.key}`, [
            `Docs: ${variable.docsUrl}`,
            "Press Enter to skip for now.",
          ]),
        })
      );
      if (value.trim().length > 0) {
        collected.set(variable.key, value);
      } else {
        skippedRequiredKeys.add(variable.key);
      }
    }
  }
  return {
    defaults: collected,
    skippedRequiredKeys,
  };
};

const renderDeferredPlatformEnvGuidance = (
  selectedPlatforms: Platform[],
  pendingKeys?: ReadonlySet<string>
): string[] => {
  const lines: string[] = [];
  let hasSection = false;

  for (const platform of selectedPlatforms) {
    if (platform === "web") {
      continue;
    }

    const metadata = PLATFORM_METADATA[platform];
    const requiredVariables = metadata.envVariables.filter((variable) => {
      if (!variable.required) {
        return false;
      }
      if (!pendingKeys) {
        return true;
      }
      return pendingKeys.has(variable.key);
    });
    if (requiredVariables.length === 0) {
      continue;
    }

    if (hasSection) {
      lines.push("");
    }

    lines.push(renderSectionBadge(metadata.label));
    for (const variable of requiredVariables) {
      lines.push(`- ${variable.key}`);
    }
    hasSection = true;
  }

  return lines;
};

const run = async (): Promise<void> => {
  const cliArgs = process.argv.slice(2);
  handleLifecycleCommandAttempt(cliArgs);
  const dependencyChannel =
    parseDependencyChannelArg(cliArgs) ?? resolveDefaultDependencyChannel();

  printBanner();

  const botName = handleCancel(
    await text({
      message: "Bot name",
      placeholder: pickBotNamePlaceholder(),
      validate: validateRequired,
    })
  );

  const projectName = deriveBotId(botName);

  const targetDirInput = handleCancel(
    await text({
      message: "Target directory",
      initialValue: `./${projectName}`,
      validate: ensureEmptyDirValidation,
    })
  ).trim();

  const targetDir = resolve(process.cwd(), targetDirInput);

  const prompt = handleCancel(
    await text({
      message: "Bot prompt",
      placeholder: pickPromptPlaceholder(),
      validate: validateRequired,
    })
  );

  const { model, provider, apiKeyEnvKey, apiKey } = await promptModel();

  const platforms = handleCancel(
    await multiselect({
      message: "Select platforms",
      options: CHAT_PLATFORMS.map((platform) => ({
        value: platform,
        label: platform,
      })),
      initialValues: ["web"],
      required: true,
    })
  ) as Platform[];

  const selectedRemotePlatforms = platforms.filter(
    (platform) => platform !== "web"
  );
  const shouldConfigurePlatformsNow =
    selectedRemotePlatforms.length === 0
      ? false
      : handleCancel(
          await select({
            message: "Configure platform integrations",
            options: [
              {
                label: "Later",
                value: false,
              },
              {
                label: "Now",
                value: true,
              },
            ],
            initialValue: false,
          })
        );

  const platformEnvPromptResult = shouldConfigurePlatformsNow
    ? await promptPlatformEnvVars(platforms)
    : {
        defaults: new Map<string, string>(),
        skippedRequiredKeys: new Set<string>(),
      };
  const platformEnvDefaults = platformEnvPromptResult.defaults;

  const dashboardPassword = handleCancel(
    await password({
      message: "Dashboard password",
      validate: (value) =>
        (value?.trim().length ?? 0) >= 8
          ? undefined
          : "Use at least 8 characters",
    })
  );

  const id = undefined;

  const databaseDialect = handleCancel(
    await select({
      message: "Database dialect",
      options: [
        { label: "SQLite (recommended)", value: "sqlite" },
        { label: "PostgreSQL", value: "postgres" },
        { label: "MySQL", value: "mysql" },
      ],
      initialValue: "sqlite",
    })
  ) as DatabaseDialect;

  let sqliteDatabasePath: string | undefined;
  if (databaseDialect === "sqlite") {
    sqliteDatabasePath = handleCancel(
      await text({
        message: "SQLite database path",
        initialValue: "./goodchat.db",
        validate: validateRequired,
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

  const config: ScaffolderConfig = {
    authEnabled: true,
    databaseDialect,
    name: botName,
    prompt,
    platforms,
    id,
    plugins,
    model,
  };

  const envMetadata = getEnvMetadataForConfig({
    authEnabled: true,
    platforms,
    plugins,
    provider,
  });

  const envDefaults = new Map<string, string>();
  envDefaults.set("GOODCHAT_DASHBOARD_PASSWORD", dashboardPassword);
  if (sqliteDatabasePath) {
    envDefaults.set("DATABASE_URL", sqliteDatabasePath);
  }
  if (apiKeyEnvKey && apiKey !== undefined) {
    envDefaults.set(apiKeyEnvKey, apiKey);
  }
  for (const [key, value] of platformEnvDefaults) {
    envDefaults.set(key, value);
  }

  const envMetadataWithDefaults = envMetadata.map((meta) => {
    const override = envDefaults.get(meta.key);
    if (override === undefined) {
      return meta;
    }
    return {
      ...meta,
      defaultValue: override,
    };
  });

  const files = await createProjectFiles({
    projectName,
    config,
    dependencyChannel,
    envMetadata: envMetadataWithDefaults,
  });

  const writer = spinner();
  writer.start("Creating project files");
  await writeFiles(targetDir, files);
  writer.stop("Project created");
  const { completedSetupCommands, setupErrorMessage } =
    await runOptionalSetup(targetDir);

  const deferredPlatformEnvLines = shouldConfigurePlatformsNow
    ? renderDeferredPlatformEnvGuidance(
        platforms,
        platformEnvPromptResult.skippedRequiredKeys
      )
    : renderDeferredPlatformEnvGuidance(platforms);

  const providerLabel =
    MODEL_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ??
    provider;
  const isProviderEnvMissing =
    apiKeyEnvKey !== undefined && (apiKey?.trim().length ?? 0) === 0;
  const deferredProviderEnvLines = isProviderEnvMissing
    ? [renderSectionBadge(`LLM ${providerLabel}`), `- ${apiKeyEnvKey}`]
    : [];

  const deferredEnvLines =
    deferredPlatformEnvLines.length > 0 && deferredProviderEnvLines.length > 0
      ? [...deferredProviderEnvLines, "", ...deferredPlatformEnvLines]
      : [...deferredProviderEnvLines, ...deferredPlatformEnvLines];

  const nextStepCommands = buildNextStepCommands(
    targetDirInput,
    completedSetupCommands
  );

  const summaryLines = [
    "A goodchat project was initialized. Happy hacking!",
    "",
    renderCard("Next steps", nextStepCommands),
  ];

  if (setupErrorMessage) {
    summaryLines.push("", `${DIM}${setupErrorMessage}${RST}`);
  }

  if (deferredEnvLines.length > 0) {
    summaryLines.push(
      "",
      "The following env variables were left empty in your .env file:",
      renderCard("", deferredEnvLines)
    );
  }

  summaryLines.push(
    "",
    `${DIM}Contribute to the project: https://github.com/mateoroldos/goodchat${RST}`
  );

  outro(summaryLines.join("\n"), { withGuide: true });
};

await run();
