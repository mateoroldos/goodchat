import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type {
  DatabaseDialect,
  Platform,
} from "@goodchat/contracts/config/types";
import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
import { resolveModelFactoryName } from "@goodchat/contracts/model/provider-metadata";
import { renderDbSchemaArtifacts } from "@goodchat/templates/scaffold/db-schema-artifacts";
import { nanoid } from "nanoid";
import type { DatabaseProfileId } from "./database-profiles";
import {
  type EnvVariableMeta,
  getEnvMetadata,
  type Provider,
} from "./env-metadata";
import {
  type DependencyChannel,
  GOODCHAT_DEPENDENCY_MANIFEST,
  resolveDefaultDependencyChannel,
} from "./version-manifest";

export interface SelectedModel {
  modelId: string;
  provider: ModelProvider;
}

export interface GeneratorConfig {
  authEnabled: boolean;
  databaseDialect: DatabaseDialect;
  databaseProfileId?: DatabaseProfileId;
  id?: string;
  mcp?: MCPServerConfig[];
  model?: SelectedModel;
  name: string;
  platforms: Platform[];
  plugins?: string[];
  prompt: string;
}

export type ScaffolderConfig = GeneratorConfig;

export interface ProjectFile {
  content: string;
  path: string;
}

export interface ProjectTemplateInput {
  config: GeneratorConfig;
  dependencyChannel?: DependencyChannel;
  envMetadata: EnvVariableMeta[];
  projectName: string;
}

const SEMVER_VERSION_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

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
  if (!SEMVER_VERSION_REGEX.test(version)) {
    return version;
  }
  return `^${version}`;
};

const DRIZZLE_ORM_VERSION = "^0.45.2";
const DRIZZLE_KIT_VERSION = "^0.31.10";
const TSDOWN_VERSION = "^0.16.5";
const TYPESCRIPT_VERSION = "^5.9.3";
const TYPES_BUN_VERSION = "^1.3.4";
const SECRET_LENGTH = 48;

export const getEnvMetadataForConfig = (input: {
  authEnabled?: boolean;
  platforms: Platform[];
  plugins?: string[];
  provider?: Provider | null;
}): EnvVariableMeta[] => {
  return getEnvMetadata({
    authEnabled: input.authEnabled,
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
  const authSecretMeta = metadata.find(
    (item) => item.key === "GOODCHAT_AUTH_SECRET"
  );
  if (authSecretMeta && !authSecretMeta.defaultValue) {
    secretOverrides.set("GOODCHAT_AUTH_SECRET", nanoid(SECRET_LENGTH));
  }
  const cronMeta = metadata.find((item) => item.key === "CRON_SECRET");
  if (cronMeta && !cronMeta.defaultValue) {
    secretOverrides.set("CRON_SECRET", nanoid(SECRET_LENGTH));
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
  const coreImports = ["createGoodchat"];
  imports.push('import { schema } from "./db/schema";');
  imports.push('import { env } from "./env";');
  if (config.databaseDialect === "sqlite") {
    imports.push('import { sqlite } from "@goodchat/storage/sqlite";');
  }
  if (config.databaseDialect === "postgres") {
    imports.push('import { postgres } from "@goodchat/storage/postgres";');
  }
  if (config.databaseDialect === "mysql") {
    imports.push('import { mysql } from "@goodchat/storage/mysql";');
  }
  if (config.model) {
    const factoryName = resolveModelFactoryName(config.model.provider);
    coreImports.push(factoryName);
  }
  imports.unshift(
    `import { ${coreImports.join(", ")} } from "@goodchat/core";`
  );
  const plugins = config.plugins ?? [];
  if (plugins.includes("linear")) {
    imports.push('import { linear } from "@goodchat/plugins/linear";');
  }

  let databaseExpression =
    "mysql({ connectionString: env.DATABASE_URL, schema })";
  if (config.databaseDialect === "sqlite") {
    databaseExpression = "sqlite({ path: env.DATABASE_URL, schema })";
  }
  if (config.databaseDialect === "postgres") {
    databaseExpression =
      config.databaseProfileId === "postgres-neon"
        ? 'postgres({ connectionString: env.DATABASE_URL, driver: "@neondatabase/serverless", schema })'
        : "postgres({ connectionString: env.DATABASE_URL, schema })";
  }
  if (config.databaseDialect === "mysql") {
    databaseExpression =
      config.databaseProfileId === "mysql-planetscale"
        ? 'mysql({ connectionString: env.DATABASE_URL, mode: "planetscale", schema })'
        : "mysql({ connectionString: env.DATABASE_URL, schema })";
  }

  const entries: string[] = [
    `  name: ${JSON.stringify(config.name)},`,
    `  prompt: ${JSON.stringify(config.prompt)},`,
    `  platforms: ${JSON.stringify(config.platforms)},`,
  ];

  const authEnabledExpression = config.authEnabled
    ? 'env.ENVIRONMENT !== "development"'
    : "false";

  if (config.id) {
    entries.push(`  id: ${JSON.stringify(config.id)},`);
  }

  if (plugins.length > 0) {
    entries.push(`  plugins: [${plugins.join(", ")}],`);
  }

  if (config.model) {
    const factoryName = resolveModelFactoryName(config.model.provider);
    entries.push(
      `  model: ${factoryName}(${JSON.stringify(config.model.modelId)}),`
    );
  }

  if (config.mcp && config.mcp.length > 0) {
    const mcpValue = JSON.stringify(config.mcp, null, 2)
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    entries.push(`  mcp: ${mcpValue.trimStart()},`);
  }

  entries.push("  auth: {");
  entries.push(`    enabled: ${authEnabledExpression},`);
  if (config.authEnabled) {
    entries.push("    password: env.GOODCHAT_DASHBOARD_PASSWORD,");
  }
  entries.push("  },");
  entries.push(`  database: ${databaseExpression},`);

  return `${imports.join("\n")}

export const goodchat = createGoodchat({
${entries.join("\n")}
});
`;
};

export const renderIndexFile = (): string => {
  return `import "./env";
import { goodchat } from "./goodchat";

const port = Number(process.env.PORT ?? 3000);
const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const { app } = await goodchat.ready;

if (!isServerless) {
  app.listen(port, () => {
    console.log(\`Server is running on http://localhost:\${port}\`);
  });
}

export default app;
`;
};

export const renderSqliteMigrateFile = (): string => {
  return `import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database(process.env.DATABASE_URL);
const database = drizzle(sqlite);

migrate(database, { migrationsFolder: "./drizzle" });
console.log("SQLite migrations applied successfully.");
sqlite.close();
`;
};

export const renderPackageJson = (input: {
  databaseDialect: DatabaseDialect;
  dependencyChannel?: DependencyChannel;
  projectName: string;
  usesPlugins: boolean;
}): string => {
  const dependencyChannel =
    input.dependencyChannel ?? resolveDefaultDependencyChannel();
  const dependencyManifest = GOODCHAT_DEPENDENCY_MANIFEST[dependencyChannel];

  const dependencies: Record<string, string> = {
    "@goodchat/cli": formatPublishedVersion(
      dependencyManifest["@goodchat/cli"],
      "^0.0.1"
    ),
    "@goodchat/core": formatPublishedVersion(
      dependencyManifest["@goodchat/core"],
      "^0.0.1"
    ),
    "@t3-oss/env-core": "^0.13.1",
    dotenv: "^17.2.2",
    "drizzle-orm": DRIZZLE_ORM_VERSION,
    elysia: "^1.4.28",
    zod: "^4.1.13",
  };

  if (input.usesPlugins) {
    dependencies["@goodchat/plugins"] = formatPublishedVersion(
      dependencyManifest["@goodchat/plugins"],
      "^0.0.1"
    );
  }

  if (
    input.databaseDialect === "sqlite" ||
    input.databaseDialect === "postgres" ||
    input.databaseDialect === "mysql"
  ) {
    dependencies["@goodchat/storage"] = formatPublishedVersion(
      dependencyManifest["@goodchat/storage"],
      "^0.0.1"
    );
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": TYPES_BUN_VERSION,
    "drizzle-kit": DRIZZLE_KIT_VERSION,
    tsdown: TSDOWN_VERSION,
    typescript: TYPESCRIPT_VERSION,
  };

  const migrateCommand =
    input.databaseDialect === "sqlite"
      ? "bun run src/db/migrate.ts"
      : "drizzle-kit migrate --config=drizzle.config.ts";

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
      "db:migrate": migrateCommand,
      "db:push": "drizzle-kit push --config=drizzle.config.ts",
      "db:studio": "drizzle-kit studio --config=drizzle.config.ts",
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
    "noEmit": true,
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

export const createProjectFiles = async (
  input: ProjectTemplateInput
): Promise<ProjectFile[]> => {
  const usesPlugins = (input.config.plugins ?? []).length > 0;
  const schemaFiles = await renderDbSchemaArtifacts({
    authEnabled: input.config.authEnabled,
    dialect: input.config.databaseDialect,
  });
  const sqliteMigrateFile =
    input.config.databaseDialect === "sqlite"
      ? [
          {
            path: "src/db/migrate.ts",
            content: renderSqliteMigrateFile(),
          },
        ]
      : [];

  return [
    {
      path: "package.json",
      content: renderPackageJson({
        databaseDialect: input.config.databaseDialect,
        dependencyChannel: input.dependencyChannel,
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
    ...sqliteMigrateFile,
    ...Object.entries(schemaFiles).map(([path, content]) => ({
      path,
      content,
    })),
  ];
};
