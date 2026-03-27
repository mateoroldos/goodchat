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
  envVariables: string[];
  projectName: string;
}

const BASE_ENV_VARIABLES = [
  "OPENAI_API_KEY",
  "WEBHOOK_FORWARD_URL",
  "CORS_ORIGIN",
  "REDIS_URL",
  "CRON_SECRET",
  "SERVERLESS",
  "NODE_ENV",
];

const PLATFORM_ENV_VARIABLES: Record<Platform, string[]> = {
  local: [],
  slack: [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_ENCRYPTION_KEY",
  ],
  discord: [
    "DISCORD_BOT_TOKEN",
    "DISCORD_PUBLIC_KEY",
    "DISCORD_APPLICATION_ID",
    "DISCORD_MENTION_ROLE_IDS",
  ],
  teams: ["TEAMS_APP_ID", "TEAMS_APP_PASSWORD", "TEAMS_APP_TENANT_ID"],
  gchat: [
    "GOOGLE_CHAT_CREDENTIALS",
    "GOOGLE_CHAT_USE_ADC",
    "GOOGLE_CHAT_PUBSUB_TOPIC",
    "GOOGLE_CHAT_IMPERSONATE_USER",
  ],
};

const PLUGIN_ENV_VARIABLES: Record<string, string[]> = {
  linear: ["LINEAR_API_TOKEN"],
};

const ENV_SCHEMA_LINES: Record<string, string> = {
  OPENAI_API_KEY: 'z.string().min(1, "OpenAI API key is required")',
  WEBHOOK_FORWARD_URL: "z.string().url().optional()",
  CORS_ORIGIN: "z.string().url().optional()",
  REDIS_URL: "z.string().url().optional()",
  SLACK_BOT_TOKEN: "z.string().optional()",
  SLACK_SIGNING_SECRET: "z.string().optional()",
  SLACK_CLIENT_ID: "z.string().optional()",
  SLACK_CLIENT_SECRET: "z.string().optional()",
  SLACK_ENCRYPTION_KEY: "z.string().optional()",
  DISCORD_BOT_TOKEN: "z.string().optional()",
  DISCORD_PUBLIC_KEY: "z.string().optional()",
  DISCORD_APPLICATION_ID: "z.string().optional()",
  DISCORD_MENTION_ROLE_IDS: "z.string().optional()",
  CRON_SECRET: "z.string().optional()",
  TEAMS_APP_ID: "z.string().optional()",
  TEAMS_APP_PASSWORD: "z.string().optional()",
  TEAMS_APP_TENANT_ID: "z.string().optional()",
  GOOGLE_CHAT_CREDENTIALS: "z.string().optional()",
  GOOGLE_CHAT_USE_ADC: "z.string().optional()",
  GOOGLE_CHAT_PUBSUB_TOPIC: "z.string().optional()",
  GOOGLE_CHAT_IMPERSONATE_USER: "z.string().optional()",
  SERVERLESS: 'z.enum(["true", "false"]).optional()',
  NODE_ENV:
    'z.enum(["development", "production", "test"]).default("development")',
  LINEAR_API_TOKEN: "z.string().optional()",
};

const ENV_DEFAULTS: Record<string, string> = {
  CORS_ORIGIN: "http://localhost:3000",
};

const PUBLISHED_CORE_VERSION = "^0.0.1";
const PUBLISHED_PLUGINS_VERSION = "^0.0.1";

const unique = (items: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
};

export const getEnvVariables = (input: {
  platforms: Platform[];
  plugins?: string[];
}): string[] => {
  const platformVariables = input.platforms.flatMap(
    (platform) => PLATFORM_ENV_VARIABLES[platform]
  );
  const pluginVariables = (input.plugins ?? []).flatMap(
    (plugin) => PLUGIN_ENV_VARIABLES[plugin] ?? []
  );

  return unique([
    ...BASE_ENV_VARIABLES,
    ...platformVariables,
    ...pluginVariables,
  ]);
};

export const renderEnvSchemaFile = (variables: string[]): string => {
  const entries = variables
    .map((variable) => {
      const schema = ENV_SCHEMA_LINES[variable] ?? "z.string().optional()";
      return `    ${variable}: ${schema},`;
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

export const renderEnvFile = (variables: string[]): string => {
  return variables
    .map((variable) => {
      const defaultValue = ENV_DEFAULTS[variable] ?? "";
      return `${variable}="${defaultValue}"`;
    })
    .join("\n");
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
      content: renderEnvSchemaFile(input.envVariables),
    },
    {
      path: ".env",
      content: renderEnvFile(input.envVariables),
    },
    {
      path: ".env.example",
      content: renderEnvFile(input.envVariables),
    },
    {
      path: ".gitignore",
      content: renderGitignore(),
    },
  ];
};
