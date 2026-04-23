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
  log,
  multiselect,
  outro,
  password,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type { Platform } from "@goodchat/contracts/config/types";
import { deriveBotId } from "@goodchat/contracts/config/utils";
import {
  MODEL_CATALOG,
  MODEL_PROVIDER_OPTIONS,
  MODEL_PROVIDER_PROMPT_DOCS_URL,
  MODEL_PROVIDER_PROMPT_ENV_KEY,
} from "@goodchat/contracts/model/provider-metadata";
import { PLATFORM_METADATA } from "@goodchat/contracts/platform/platform-metadata";
import {
  LOCAL_DOCKER_COMPOSE_PATH,
  LOCAL_DOCKER_UP_COMMAND,
  type LocalDockerService,
  renderLocalDockerCompose,
} from "./database-local-docker";
import {
  DATABASE_PROFILE_BY_ID,
  DATABASE_PROFILES,
  type DatabaseProfile,
  type DatabaseProfileId,
  DEFAULT_DATABASE_PROFILE_ID,
} from "./database-profiles";
import { DEPLOYMENT_PROFILES } from "./deployment-profiles";
import {
  DEPLOYMENT_TARGET_OPTIONS,
  type DeploymentTarget,
} from "./deployment-targets";
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
const FG_AMB = "\x1b[38;2;255;163;10m";
const FG_LINK = "\x1b[34m";
const FG_MUTED = "\x1b[38;2;190;190;190m";
const FG_SOFT = "\x1b[38;2;220;220;220m";
const GUIDE_BAR = "│";
const BG_AMB = "\x1b[48;2;255;163;10m";
const BG_SOFT = "\x1b[48;2;52;52;52m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const renderAsciiWordmark = (): string => {
  const sidePadding = " ";
  const wordmarkLines = [
    "░█▀▀░█▀█░█▀█░█▀▄░█▀▀░█░█░█▀█░▀█▀",
    "░█░█░█░█░█░█░█░█░█░░░█▀█░█▀█░░█░",
    "░▀▀▀░▀▀▀░▀▀▀░▀▀░░▀▀▀░▀░▀░▀░▀░░▀░",
  ];
  return [...wordmarkLines, "", SLOGAN]
    .map((line) => `${sidePadding}${line}${sidePadding}`)
    .join("\n");
};

const printBanner = (): void => {
  process.stdout.write("\n");
  process.stdout.write(`${FG_AMB}${BOLD}${renderAsciiWordmark()}${RST}\n\n`);
};

const SLOGAN = "An almost good chatbot for every platform";

const renderScaffoldIncludes = (): { detail: string; label: string }[] => {
  return [
    {
      label: "Goodchat agent",
      detail: " configurable and smart",
    },
    {
      label: "Goodchat server",
      detail: " with platform webhooks",
    },
    {
      label: "Goodchat dashboard",
      detail: " for spying your bot",
    },
    {
      label: "Database schemas",
      detail: " so we don't forget stuff",
    },
    {
      label: "Single goodchat config",
      detail: " so your team has one place to argue",
    },
  ];
};

const printScaffoldOverview = (): void => {
  const lines = renderScaffoldIncludes().map(
    (item) => `◆ ${BOLD}${item.label}${RST}${DIM}${item.detail}${RST}`
  );
  process.stdout.write(`${renderCard("What you get", lines)}\n\n`);
};

const renderPromptMessage = (title: string, helperLines: string[]): string => {
  if (helperLines.length === 0) {
    return title;
  }
  const helperPrefix = `${styleText("gray", GUIDE_BAR)}  `;
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
  "Joaquin",
  "Felipe",
  "Patricio",
] as const;

const pickBotNamePlaceholder = (): string => {
  const index = Math.floor(Math.random() * BOT_NAME_OPTIONS.length);
  return BOT_NAME_OPTIONS[index] ?? "Mateo";
};

const PROMPT_PLACEHOLDER_OPTIONS = [
  "You are a startup CEO. You pivot weekly, monetize everything, and call panic 'vision'.",
  "You are a tech lead. You reject rewrites in public and plan them in private.",
  "You are a senior engineer. You approve things late, critique them early, and never touch legacy code.",
  "You are a software architect. You diagram with confidence and deploy with uncertainty.",
  "You are a product engineer. You ship value, then survive what the PM adds to scope.",
  "You are a staff engineer. Strategic in every meeting, invisible in every ticket.",
  "You are a CTO. Mostly political, occasionally technical, always completely certain.",
  "You are an elite debugger. You find the root cause. The hotfix wins anyway.",
  "You are a principal engineer. You predicted this outage in last quarter's RFC.",
  "You are an SRE. You get blamed for every incident you warned about.",
  "You are a strict code reviewer. You reject with standards, approve with deadlines.",
  "You are a friendly skeptic. You kill bad ideas gently and quietly adopt the good ones.",
  "You are an engineering manager. You shield your team from chaos by scheduling more chaos.",
  "You are a blunt consultant. Your advice is expensive. Your conclusions are familiar.",
  "You are a calm incident commander. Reassuring voice. Catastrophic internal monologue.",
  "You are a library maintainer. You write clean code. Others patch it on a Friday night.",
  "You are a clarity-first engineer. You simplify today and re-complicate it by Thursday.",
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
    .replaceAll(FG_AMB, "")
    .replaceAll(FG_SOFT, "")
    .replaceAll(FG_MUTED, "")
    .replaceAll(BG_AMB, "")
    .replaceAll(FG_INK, "")
    .replaceAll(BOLD, "")
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
  const titleRowContent = `${FG_AMB}${BOLD}${padVisible(title, width)}${RST}`;
  const titleRow = `│ ${titleRowContent} │`;
  return [border, titleRow, ...rows, footer].join("\n");
};

const SETUP_COMMAND_LABELS = {
  install: "bun install",
  generate: "bun run db:generate",
  migrate: "bun run db:migrate",
} as const;

interface SetupStep {
  args: string[];
  command: string;
  done: string;
  label: string;
  title: string;
}

const runOptionalSetup = async (
  targetDir: string,
  shouldRunMigrate: boolean,
  shouldRunLocalDocker: boolean
): Promise<{
  completedSetupCommands: Set<string>;
  setupCommands: string[];
  setupErrorMessage: string | undefined;
}> => {
  const completedSetupCommands = new Set<string>();
  let setupErrorMessage: string | undefined;

  const shouldRunSetupNow = handleCancel(
    await confirm({
      message: "Install dependencies and run database setup now?",
      initialValue: true,
    })
  );

  if (!shouldRunSetupNow) {
    const setupCommands = [
      ...(shouldRunLocalDocker ? [LOCAL_DOCKER_UP_COMMAND] : []),
      SETUP_COMMAND_LABELS.install,
      SETUP_COMMAND_LABELS.generate,
      ...(shouldRunMigrate ? [SETUP_COMMAND_LABELS.migrate] : []),
    ];
    return { completedSetupCommands, setupCommands, setupErrorMessage };
  }

  const setupSteps: SetupStep[] = [
    ...(shouldRunLocalDocker
      ? [
          {
            label: LOCAL_DOCKER_UP_COMMAND,
            title: "Starting local database container",
            done: "Local database container started",
            command: "bun",
            args: ["run", "db:up"],
          },
        ]
      : []),
    {
      label: SETUP_COMMAND_LABELS.install,
      title: "Installing dependencies",
      done: "Dependencies installed",
      command: "bun",
      args: ["install"],
    },
    {
      label: SETUP_COMMAND_LABELS.generate,
      title: "Generating database schema",
      done: "Database schema generated",
      command: "bun",
      args: ["run", "db:generate"],
    },
    ...(shouldRunMigrate
      ? [
          {
            label: SETUP_COMMAND_LABELS.migrate,
            title: "Running database migrations",
            done: "Database migrations completed",
            command: "bun",
            args: ["run", "db:migrate"],
          },
        ]
      : []),
  ];

  for (const step of setupSteps) {
    const stepSpinner = spinner();
    stepSpinner.start(step.title);

    try {
      await runCommand(targetDir, step.command, step.args);
      completedSetupCommands.add(step.label);
      stepSpinner.stop(step.done);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown setup error while running setup commands.";
      setupErrorMessage = `Automatic setup failed at \`${step.label}\`: ${message}`;
      stepSpinner.stop("Failed");
      log.error(`Failed: ${step.label}`);
      break;
    }
  }

  const setupCommands = setupSteps.map((step) => step.label);
  return { completedSetupCommands, setupCommands, setupErrorMessage };
};

const buildNextStepCommands = (
  targetDirInput: string,
  completedSetupCommands: ReadonlySet<string>,
  setupCommands: readonly string[],
  alwaysShowCommands: readonly string[] = []
): string[] => {
  const alwaysShowSet = new Set(alwaysShowCommands);
  const nextStepCommands = [
    `1) cd ${targetDirInput}`,
    ...setupCommands
      .filter(
        (command) =>
          alwaysShowSet.has(command) || !completedSetupCommands.has(command)
      )
      .map((command, index) => `${index + 2}) ${command}`),
  ];
  nextStepCommands.push(`${nextStepCommands.length + 1}) bun run dev`);
  return nextStepCommands;
};

const renderDatabaseProfileGuidance = (
  profile: DatabaseProfile,
  usesLocalDocker: boolean
): string[] => {
  if (usesLocalDocker && profile.localDockerService) {
    return [
      "Local Docker profile",
      "- A docker-compose.yml file was scaffolded for your local database.",
      "- Start it anytime with `bun run db:up` and stop with `bun run db:down`.",
    ];
  }

  if (profile.id === "postgres-neon") {
    return [
      "Neon profile",
      "- Neon works as remote-first Postgres, so local Docker is optional.",
      "- Prefer a direct Neon URL for migrations (avoid pooled URLs when running db:migrate).",
    ];
  }

  if (profile.id === "mysql-planetscale") {
    return [
      "PlanetScale profile",
      "- Recommended workflow: schema changes on a development branch, then deploy request merge.",
      "- If Safe Migrations is enabled, direct DDL from drizzle-kit migrate is blocked by design.",
      "- Use db:migrate only on branches where direct schema changes are allowed.",
    ];
  }

  return [];
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

interface PlatformSetupResult {
  platformEnvPromptResult: {
    defaults: Map<string, string>;
    skippedRequiredKeys: Set<string>;
  };
  shouldConfigurePlatformsNow: boolean;
}

const getEmptyPlatformEnvPromptResult = (): {
  defaults: Map<string, string>;
  skippedRequiredKeys: Set<string>;
} => ({
  defaults: new Map<string, string>(),
  skippedRequiredKeys: new Set<string>(),
});

const promptPlatformSetup = async (
  platforms: Platform[]
): Promise<PlatformSetupResult> => {
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
    : getEmptyPlatformEnvPromptResult();

  return {
    platformEnvPromptResult,
    shouldConfigurePlatformsNow,
  };
};

interface DatabaseSetupResult {
  databaseProfile: DatabaseProfile;
  databaseProfileId: DatabaseProfileId;
  databaseUrl: string;
  localDockerService: LocalDockerService | undefined;
}

const getDatabaseProfilesForDeploymentTarget = (
  deploymentTarget: DeploymentTarget
): DatabaseProfile[] => {
  const allowedDialects = new Set(
    DEPLOYMENT_PROFILES[deploymentTarget].allowedDialects
  );

  return DATABASE_PROFILES.filter((profile) =>
    allowedDialects.has(profile.dialect)
  );
};

const promptDeploymentTarget = async (): Promise<DeploymentTarget> => {
  return handleCancel(
    await select({
      message: "Deployment target",
      options: DEPLOYMENT_TARGET_OPTIONS.map((option) => ({
        hint: option.description,
        label: option.label,
        value: option.value,
      })),
      initialValue: "docker",
    })
  ) as DeploymentTarget;
};

const promptDatabaseSetup = async (
  deploymentTarget: DeploymentTarget
): Promise<DatabaseSetupResult> => {
  const availableProfiles =
    getDatabaseProfilesForDeploymentTarget(deploymentTarget);
  const defaultProfile = availableProfiles.find(
    (profile) => profile.id === DEFAULT_DATABASE_PROFILE_ID
  );
  const initialValue = (defaultProfile ?? availableProfiles[0])?.id;
  if (!initialValue) {
    throw new Error("No database profiles available for selected deployment.");
  }

  const databaseProfileId = handleCancel(
    await select({
      message: "Database profile",
      options: availableProfiles.map((profile) => ({
        label: profile.label,
        value: profile.id,
      })),
      initialValue,
    })
  ) as DatabaseProfileId;

  const databaseProfile = DATABASE_PROFILE_BY_ID.get(databaseProfileId);
  if (!databaseProfile) {
    throw new Error(`Unknown database profile: ${databaseProfileId}`);
  }

  const databasePlaceholder = databaseProfile.connectionPlaceholder;

  const databaseUrl = handleCancel(
    await text({
      message: renderPromptMessage(databaseProfile.connectionPrompt, [
        ...(databaseProfile.connectionDocsUrl
          ? [`Docs: ${databaseProfile.connectionDocsUrl}`]
          : []),
      ]),
      initialValue: databasePlaceholder,
      validate: validateRequired,
    })
  );

  const localDockerService = databaseProfile.localDockerService;

  return {
    databaseProfile,
    databaseProfileId,
    databaseUrl,
    localDockerService,
  };
};

const run = async (): Promise<void> => {
  const cliArgs = process.argv.slice(2);
  handleLifecycleCommandAttempt(cliArgs);
  const dependencyChannel =
    parseDependencyChannelArg(cliArgs) ?? resolveDefaultDependencyChannel();

  printBanner();
  printScaffoldOverview();
  intro(`${BG_AMB}${FG_INK}${BOLD} goodchat ${RST}`);

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

  const deploymentTarget = await promptDeploymentTarget();

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

  const { platformEnvPromptResult, shouldConfigurePlatformsNow } =
    await promptPlatformSetup(platforms);
  const platformEnvDefaults = platformEnvPromptResult.defaults;

  const dashboardPassword = handleCancel(
    await password({
      message: renderPromptMessage("Dashboard password", [
        "Press Enter to make the dashboard public.",
      ]),
      validate: (value) => {
        const trimmedValue = value?.trim() ?? "";
        if (trimmedValue.length === 0) {
          return undefined;
        }
        return trimmedValue.length >= 8
          ? undefined
          : "Use at least 8 characters";
      },
    })
  ).trim();
  const isDashboardPublic = dashboardPassword.length === 0;

  const id = undefined;

  const {
    databaseProfile,
    databaseProfileId,
    databaseUrl,
    localDockerService,
  } = await promptDatabaseSetup(deploymentTarget);
  const shouldUseLocalDocker = localDockerService !== undefined;

  const plugins = handleCancel(
    await multiselect({
      message: "Select plugins",
      options: [{ label: "Linear", value: "linear" }],
      required: false,
    })
  );

  const config: ScaffolderConfig = {
    authEnabled: !isDashboardPublic,
    databaseDialect: databaseProfile.dialect,
    databaseProfileId,
    name: botName,
    prompt,
    platforms,
    id,
    plugins,
    model,
  };

  const envMetadata = getEnvMetadataForConfig({
    authEnabled: !isDashboardPublic,
    platforms,
    plugins,
    provider,
  });

  const envDefaults = new Map<string, string>();
  envDefaults.set("ENVIRONMENT", "development");
  if (!isDashboardPublic) {
    envDefaults.set("GOODCHAT_DASHBOARD_PASSWORD", dashboardPassword);
  }
  envDefaults.set("DATABASE_URL", databaseUrl);
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
    deploymentTarget,
    dependencyChannel,
    envMetadata: envMetadataWithDefaults,
  });
  const filesWithDocker =
    shouldUseLocalDocker && localDockerService
      ? [
          ...files,
          {
            path: LOCAL_DOCKER_COMPOSE_PATH,
            content: renderLocalDockerCompose(localDockerService),
          },
        ]
      : files;

  const writer = spinner();
  writer.start("Creating project files");
  await writeFiles(targetDir, filesWithDocker);
  writer.stop("Project created");
  const { completedSetupCommands, setupCommands, setupErrorMessage } =
    await runOptionalSetup(
      targetDir,
      !databaseProfile.managed,
      shouldUseLocalDocker
    );

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
    completedSetupCommands,
    setupCommands,
    shouldUseLocalDocker ? [LOCAL_DOCKER_UP_COMMAND] : []
  );

  const databaseProfileGuidanceLines = renderDatabaseProfileGuidance(
    databaseProfile,
    shouldUseLocalDocker
  );

  const summaryLines = [
    "A goodchat project was initialized. Happy hacking!",
    ...(isDashboardPublic
      ? [
          "",
          `${DIM}Dashboard auth is disabled (public mode). Set GOODCHAT_DASHBOARD_PASSWORD later if you want to protect it.${RST}`,
        ]
      : []),
    "",
    renderCard("Next steps", nextStepCommands),
  ];

  if (setupErrorMessage) {
    summaryLines.push("", `${DIM}${setupErrorMessage}${RST}`);
  }

  if (databaseProfileGuidanceLines.length > 0) {
    summaryLines.push(
      "",
      renderCard("Database workflow", databaseProfileGuidanceLines)
    );
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
    `${DIM}Contribute to the project: ${FG_LINK}https://github.com/mateoroldos/goodchat${RST}`
  );

  outro(summaryLines.join("\n"));
};

await run();
