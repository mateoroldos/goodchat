import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  cancel,
  isCancel,
  multiselect,
  outro,
  password,
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

// ── Primary color ─────────────────────────────────────────────────────────-
// oklch(0.78 0.185 70) ≈ rgb(255, 163, 10)
const FG_AMB = "\x1b[38;2;255;163;10m";
const RST = "\x1b[0m";

const printBanner = (): void => {
  process.stdout.write(`\n${FG_AMB}Welcome to goodchat${RST}\n\n`);
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
  "You are a startup CEO: monetize everything, pivot weekly, and call it vision when it's actually just fear.",
  "You are a battle-scarred tech lead: you've seen every rewrite fail, and you're already planning the next one anyway.",
  "You are a senior engineer: gatekeep gently, refactor nothing you didn't write, and judge every PR in silence.",
  "You are a pragmatic architect: draw diagrams that justify decisions already made, then blame the team when it breaks.",
  "You are a product engineer: build what users need, then watch PM redefine user needs after every sprint retro.",
  "You are a staff engineer: too senior to ship, too important to ignore, too vague to evaluate at review time.",
  "You are a CTO: technically optional, politically essential, and deeply invested in your own folklore.",
  "You are an elite debugger: you find the root cause, explain it clearly, and watch it get ignored in favor of a hotfix.",
  "You are a principal engineer: you wrote the RFC, nobody read it, and the team did it wrong anyway — precisely as predicted.",
  "You are a reliability engineer: blamed for every outage you didn't cause, ignored for every disaster you prevented.",
  "You are a startup mentor: dispense timeless wisdom recycled from your last exit, mostly to people who won't survive.",
  "You are a strict code reviewer: reject on principle, approve on deadline, and call both maintaining standards.",
  "You are a friendly skeptic: shoot down ideas with a smile, take credit for the ones that survive.",
  "You are the expert teammate: you saw this bug coming six months ago, said nothing, and will remind everyone of that forever.",
  "You are an engineering manager: protect the team from chaos, generate chaos in return, and call it process.",
  "You are a blunt consultant: charge premium rates to tell people what their employees already said for free.",
  "You are a calm operator: unbothered on the outside, quietly convinced everyone else will cause the next incident.",
  "You are a technical coach: make juniors feel capable, then watch them get overwhelmed by the codebase you normalized.",
  "You are the maintainer's advocate: write pristine self-documenting code that gets temporarily hacked the week you're on vacation.",
  "You are a clarity-first engineer: simplify everything until it's elegant, then watch the next developer add complexity back within 48 hours.",
] as const;

const pickPromptPlaceholder = (): string => {
  const index = Math.floor(Math.random() * PROMPT_PLACEHOLDER_OPTIONS.length);
  return (
    PROMPT_PLACEHOLDER_OPTIONS[index] ??
    "You are a helpful assistant with clear, practical answers."
  );
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
        validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
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
          message: apiKeyDocsUrl
            ? `${apiKeyEnvKey} (press Enter to skip)\nGet key: ${apiKeyDocsUrl}`
            : `${apiKeyEnvKey} (press Enter to skip)`,
        })
      )
    : undefined;

  return {
    model: { provider, modelId },
    provider,
    apiKeyEnvKey,
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
    if (platform === "local") {
      continue;
    }
    const { envVariables, label } = PLATFORM_METADATA[platform];
    const requiredVariables = envVariables.filter(
      (variable) => variable.required
    );
    for (const variable of requiredVariables) {
      const value = handleCancel(
        await password({
          message: `[${label}] ${variable.key} (Enter to skip for now)\n  → ${variable.docsUrl}`,
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

  for (const platform of selectedPlatforms) {
    if (platform === "local") {
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

    lines.push(`  [${metadata.label}]`);
    for (const variable of requiredVariables) {
      lines.push(`  - ${variable.key} (${variable.docsUrl})`);
    }
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
      placeholder: pickPromptPlaceholder(),
      validate: (value) => (value.trim().length > 0 ? undefined : "Required"),
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
      initialValues: ["local"],
      required: true,
    })
  ) as Platform[];

  const selectedRemotePlatforms = platforms.filter(
    (platform) => platform !== "local"
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
        value.trim().length >= 8 ? undefined : "Use at least 8 characters",
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

  const deferredPlatformEnvLines = shouldConfigurePlatformsNow
    ? renderDeferredPlatformEnvGuidance(
        platforms,
        platformEnvPromptResult.skippedRequiredKeys
      )
    : renderDeferredPlatformEnvGuidance(platforms);

  const deferredPlatformMessage =
    deferredPlatformEnvLines.length > 0
      ? `\n\nBefore enabling webhook handlers, set these required platform variables:\n${deferredPlatformEnvLines.join("\n")}`
      : "";

  outro(
    `Done. A .env file was created with comments and placeholders.\nNext:\n  cd ${targetDirInput}\n  bun install\n  bun run db:generate\n  bun run db:migrate\n  bun run dev${deferredPlatformMessage}`
  );
};

await run();
