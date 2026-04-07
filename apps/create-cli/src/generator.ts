import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type {
  DatabaseDialect,
  Platform,
} from "@goodchat/contracts/config/types";
import {
  type EnvVariableMeta,
  getEnvMetadata,
  type Provider,
} from "./env-metadata";

export interface GeneratorConfig {
  databaseDialect: DatabaseDialect;
  id?: string;
  isServerless: boolean;
  mcp?: MCPServerConfig[];
  model?: string;
  name: string;
  platforms: Platform[];
  plugins?: string[];
  prompt: string;
  withDashboard: boolean;
}

export type ScaffolderConfig = GeneratorConfig;

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
const PUBLISHED_ADAPTER_SQLITE_VERSION = formatPublishedVersion(
  readWorkspaceVersion("packages/adapter-sqlite/package.json"),
  "^0.0.1"
);
const PUBLISHED_ADAPTER_POSTGRES_VERSION = formatPublishedVersion(
  readWorkspaceVersion("packages/adapter-postgres/package.json"),
  "^0.0.1"
);
const PUBLISHED_ADAPTER_MYSQL_VERSION = formatPublishedVersion(
  readWorkspaceVersion("packages/adapter-mysql/package.json"),
  "^0.0.1"
);
const PUBLISHED_GOODCHAT_CLI_VERSION = formatPublishedVersion(
  readWorkspaceVersion("apps/goodchat-cli/package.json"),
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

export const renderGoodchatFile = (config: GeneratorConfig): string => {
  const imports: string[] = [];
  if (config.databaseDialect === "sqlite") {
    imports.push('import { sqlite } from "@goodchat/adapter-sqlite";');
  }
  if (config.databaseDialect === "postgres") {
    imports.push('import { postgres } from "@goodchat/adapter-postgres";');
  }
  if (config.databaseDialect === "mysql") {
    imports.push('import { mysql } from "@goodchat/adapter-mysql";');
  }
  const plugins = config.plugins ?? [];
  if (plugins.includes("linear")) {
    imports.push('import { linear } from "@goodchat/plugins/linear";');
  }

  let databaseExpression =
    'mysql({ connectionString: process.env.DATABASE_URL || "" })';
  if (config.databaseDialect === "sqlite") {
    databaseExpression =
      'sqlite({ path: process.env.DATABASE_URL || "./goodchat.db" })';
  }
  if (config.databaseDialect === "postgres") {
    databaseExpression =
      'postgres({ connectionString: process.env.DATABASE_URL || "" })';
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
  entries.push(`  database: ${databaseExpression},`);
  entries.push(
    '  isServerless: process.env.SERVERLESS === "true" || process.env.VERCEL === "1",'
  );

  return `${imports.join("\n")}

export const goodchat = {
${entries.join("\n")}
};
`;
};

export const renderIndexFile = (): string => {
  return `import "./env";
import { createGoodchat } from "@goodchat/core";
import { goodchat } from "./goodchat";

const port = Number(process.env.PORT ?? 3000);
const { app } = await createGoodchat(goodchat);

if (!goodchat.isServerless) {
  app.listen(port, () => {
    console.log(\`Server is running on http://localhost:\${port}\`);
  });
}

export default app;
`;
};

export const renderPackageJson = (input: {
  databaseDialect: DatabaseDialect;
  projectName: string;
  usesPlugins: boolean;
}): string => {
  const dependencies: Record<string, string> = {
    "@goodchat/cli": PUBLISHED_GOODCHAT_CLI_VERSION,
    "@goodchat/core": PUBLISHED_CORE_VERSION,
    "@t3-oss/env-core": "^0.13.1",
    dotenv: "^17.2.2",
    elysia: "^1.4.28",
    zod: "^4.1.13",
  };

  if (input.usesPlugins) {
    dependencies["@goodchat/plugins"] = PUBLISHED_PLUGINS_VERSION;
  }

  if (input.databaseDialect === "sqlite") {
    dependencies["@goodchat/adapter-sqlite"] = PUBLISHED_ADAPTER_SQLITE_VERSION;
  }
  if (input.databaseDialect === "postgres") {
    dependencies["@goodchat/adapter-postgres"] =
      PUBLISHED_ADAPTER_POSTGRES_VERSION;
  }
  if (input.databaseDialect === "mysql") {
    dependencies["@goodchat/adapter-mysql"] = PUBLISHED_ADAPTER_MYSQL_VERSION;
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": "^1.3.4",
    "drizzle-kit": "^0.31.10",
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
      "db:schema:sync": "goodchat db schema sync",
      "db:schema:check": "goodchat db schema sync --check",
      "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
      "db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
      "db:push": "drizzle-kit push --config=drizzle.config.ts",
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
        databaseDialect: input.config.databaseDialect,
        projectName: input.projectName,
        usesPlugins,
      }),
    },
    {
      path: "tsconfig.json",
      content: renderTsconfig(),
    },
    {
      path: "src/goodchat.ts",
      content: renderGoodchatFile(input.config),
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
