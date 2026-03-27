import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type EnvVariableMeta,
  getEnvMetadata,
  type Provider,
} from "./env-metadata";

export type Platform = "local" | "slack" | "discord" | "teams" | "gchat";

export type McpTransport =
  | {
      type: "http" | "sse";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };

export interface McpServerConfig {
  name: string;
  transport: McpTransport;
}

export interface GeneratorConfig {
  id?: string;
  isServerless: boolean;
  mcp?: McpServerConfig[];
  model?: string;
  name: string;
  platforms: Platform[];
  plugins?: string[];
  prompt: string;
  withDashboard: boolean;
}

export interface ProjectFile {
  content: string;
  path: string;
}

export interface ProjectTemplateInput {
  config: GeneratorConfig;
  envMetadata: EnvVariableMeta[];
  projectName: string;
}

const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../.."
);

const readWorkspaceVersion = (packageRelativePath: string): string | null => {
  try {
    const filePath = resolve(WORKSPACE_ROOT, packageRelativePath);
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as { version?: unknown };
    if (
      typeof parsed.version !== "string" ||
      parsed.version.trim().length === 0
    ) {
      return null;
    }
    return parsed.version;
  } catch {
    return null;
  }
};

const formatPublishedVersion = (
  version: string | null,
  fallback: string
): string => {
  if (!version) {
    return fallback;
  }
  if (version.startsWith("^") || version.startsWith("~")) {
    return version;
  }
  return `^${version}`;
};

const PUBLISHED_CORE_VERSION = formatPublishedVersion(
  readWorkspaceVersion("packages/core/package.json"),
  "^0.0.1"
);
const PUBLISHED_PLUGINS_VERSION = formatPublishedVersion(
  readWorkspaceVersion("packages/plugins/package.json"),
  "^0.0.1"
);

export const getEnvMetadataForConfig = (input: {
  platforms: Platform[];
  plugins?: string[];
  provider?: Provider | null;
}): EnvVariableMeta[] => {
  return getEnvMetadata({
    platforms: input.platforms,
    plugins: input.plugins,
    provider: input.provider,
  });
};

export const renderEnvSchemaFile = (metadata: EnvVariableMeta[]): string => {
  const entries = metadata
    .map((meta) => {
      const schema = meta.schema ?? "z.string().optional()";
      return `    ${meta.key}: ${schema},`;
    })
    .join("\n");

  return `import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
${entries}
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
`;
};

const applyPlatformSpacing = (
  lines: string[],
  meta: EnvVariableMeta,
  lastPlatformGroup: string | undefined
): string | undefined => {
  const platformGroup = meta.platforms?.[0];
  if (!platformGroup) {
    return lastPlatformGroup;
  }
  if (lastPlatformGroup && platformGroup !== lastPlatformGroup) {
    lines.push("");
  }
  return platformGroup;
};

export const renderEnvFile = (metadata: EnvVariableMeta[]): string => {
  const secretOverrides = new Map<string, string>();
  const cronMeta = metadata.find((item) => item.key === "CRON_SECRET");
  if (cronMeta && !cronMeta.defaultValue) {
    secretOverrides.set("CRON_SECRET", randomBytes(24).toString("hex"));
  }

  const lines: string[] = [];
  let lastCategory: string | undefined;
  let lastPlatformGroup: string | undefined;

  for (const meta of metadata) {
    const category = meta.category ?? "core";

    if (category !== lastCategory) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`# ${category[0]?.toUpperCase()}${category.slice(1)}`);
      lastCategory = category;
      lastPlatformGroup = undefined;
    }

    if (category === "platform") {
      lastPlatformGroup = applyPlatformSpacing(lines, meta, lastPlatformGroup);
    }

    if (meta?.description) {
      lines.push(`# ${meta.description}`);
    }
    if (meta?.docsUrl) {
      lines.push(`# Docs: ${meta.docsUrl}`);
    }

    const defaultValue =
      secretOverrides.get(meta.key) ?? meta.defaultValue ?? "";
    lines.push(`${meta.key}="${defaultValue}"`);
  }

  return `${lines.join("\n")}\n`;
};

export const renderAppFile = (config: GeneratorConfig): string => {
  const imports = ['import { createGoodchat } from "@goodchat/core";'];
  const plugins = config.plugins ?? [];
  if (plugins.includes("linear")) {
    imports.push('import { linear } from "@goodchat/plugins/linear";');
  }

  const entries: string[] = [
    `  name: ${JSON.stringify(config.name)},`,
    `  prompt: ${JSON.stringify(config.prompt)},`,
    `  platforms: ${JSON.stringify(config.platforms)},`,
  ];

  if (config.id) {
    entries.push(`  id: ${JSON.stringify(config.id)},`);
  }

  if (plugins.length > 0) {
    entries.push(`  plugins: [${plugins.join(", ")}],`);
  }

  if (config.model) {
    entries.push(`  model: ${JSON.stringify(config.model)},`);
  }

  if (config.mcp && config.mcp.length > 0) {
    const mcpValue = JSON.stringify(config.mcp, null, 2)
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    entries.push(`  mcp: ${mcpValue.trimStart()},`);
  }

  entries.push(`  withDashboard: ${config.withDashboard},`);
  entries.push("  isServerless,");

  return `${imports.join("\n")}

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app, api } = await createGoodchat({
${entries.join("\n")}
});

export { app };
export type App = typeof api;
`;
};

export const renderIndexFile = (): string => {
  return `import "./env";
import { app } from "./app";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const port = Number(process.env.PORT ?? 3000);
const serverApp = app;

if (!isServerless) {
  serverApp.listen(port, () => {
    console.log(\`Server is running on http://localhost:\${port}\`);
  });
}

export default serverApp;
export type { App } from "./app";
`;
};

export const renderPackageJson = (input: {
  projectName: string;
  usesPlugins: boolean;
}): string => {
  const dependencies: Record<string, string> = {
    "@goodchat/core": PUBLISHED_CORE_VERSION,
    "@t3-oss/env-core": "^0.13.1",
    dotenv: "^17.2.2",
    elysia: "^1.4.28",
    zod: "^4.1.13",
  };

  if (input.usesPlugins) {
    dependencies["@goodchat/plugins"] = PUBLISHED_PLUGINS_VERSION;
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": "^1.3.4",
    tsdown: "^0.16.5",
    typescript: "^5.9.3",
  };

  const packageJson = {
    name: input.projectName,
    type: "module",
    main: "src/index.ts",
    scripts: {
      dev: "bun run --hot src/index.ts",
      build: "tsdown",
      "check-types": "tsc -b",
      start: "bun run dist/index.mjs",
    },
    dependencies,
    devDependencies,
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
};

export const renderTsconfig = (): string => {
  return `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "verbatimModuleSyntax": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["bun"]
  },
  "include": ["src/**/*.ts"]
}
`;
};

export const renderGitignore = (): string => {
  return `node_modules
dist
.env
`;
};

export const createProjectFiles = (
  input: ProjectTemplateInput
): ProjectFile[] => {
  const usesPlugins = (input.config.plugins ?? []).length > 0;
  return [
    {
      path: "package.json",
      content: renderPackageJson({
        projectName: input.projectName,
        usesPlugins,
      }),
    },
    {
      path: "tsconfig.json",
      content: renderTsconfig(),
    },
    {
      path: "src/app.ts",
      content: renderAppFile(input.config),
    },
    {
      path: "src/index.ts",
      content: renderIndexFile(),
    },
    {
      path: "src/env.ts",
      content: renderEnvSchemaFile(input.envMetadata),
    },
    {
      path: ".env",
      content: renderEnvFile(input.envMetadata),
    },
    {
      path: ".gitignore",
      content: renderGitignore(),
    },
  ];
};
