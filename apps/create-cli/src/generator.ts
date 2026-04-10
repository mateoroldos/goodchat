import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
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
import {
  type DependencyChannel,
  GOODCHAT_DEPENDENCY_MANIFEST,
  resolveDefaultDependencyChannel,
} from "./version-manifest";

export interface GeneratorConfig {
  authEnabled: boolean;
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
  dependencyChannel?: DependencyChannel;
  envMetadata: EnvVariableMeta[];
  projectName: string;
}

const requireFromGenerator = createRequire(import.meta.url);
const CORE_SCHEMA_EXPORT_REGEX =
  /export const (sqliteSchema|postgresSchema|mysqlSchema)\s*=/;
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

const getDrizzleDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "postgresql";
  }
  return dialect;
};

const renderDrizzleCredentials = (dialect: DatabaseDialect): string => {
  if (dialect === "sqlite") {
    return '    url: process.env.DATABASE_URL || "./goodchat.db",';
  }
  return '    url: process.env.DATABASE_URL || "",';
};

const resolveCorePackageRoot = (): string | null => {
  try {
    const schemaEntryPath = requireFromGenerator.resolve(
      "@goodchat/templates/schema/sqlite"
    );
    return resolve(dirname(schemaEntryPath), "..");
  } catch {
    return null;
  }
};

const readTextFileOrNull = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const readCoreSchemaTemplate = (relativePath: string): string => {
  const corePackageRoot = resolveCorePackageRoot();
  if (corePackageRoot) {
    const candidatePath = resolve(corePackageRoot, relativePath);
    const fileContent = readTextFileOrNull(candidatePath);
    if (fileContent) {
      return fileContent;
    }
  }

  throw new Error(
    `Could not load schema template from @goodchat/templates (${relativePath}).`
  );
};

const renderCoreSchemaFile = (dialect: DatabaseDialect): string => {
  const schemaPathByDialect = {
    mysql: "schema/mysql.ts",
    postgres: "schema/postgres.ts",
    sqlite: "schema/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  const template = readCoreSchemaTemplate(schemaPathByDialect[dialect]);
  return template.replace(
    CORE_SCHEMA_EXPORT_REGEX,
    "export const coreSchema ="
  );
};

const renderAuthSchemaFile = (
  dialect: DatabaseDialect,
  authEnabled: boolean
): string => {
  if (!authEnabled) {
    return "export const authSchema = {};\n";
  }

  const authSchemaPathByDialect = {
    mysql: "schema/auth/mysql.ts",
    postgres: "schema/auth/postgres.ts",
    sqlite: "schema/auth/sqlite.ts",
  } satisfies Record<DatabaseDialect, string>;

  return readCoreSchemaTemplate(authSchemaPathByDialect[dialect]);
};

const renderComposedSchemaFile = (): string => {
  return `import { authSchema } from "./auth-schema";
import { coreSchema } from "./core-schema";
import { pluginSchema } from "./plugins/schema";

// biome-ignore lint/performance/noBarrelFile: drizzle-kit relies on exported table symbols
export * from "./auth-schema";
export * from "./core-schema";
export * from "./plugins/schema";

export const schema = {
  ...coreSchema,
  ...authSchema,
  ...pluginSchema,
};
`;
};

const renderDbSchemaArtifacts = (
  config: Pick<GeneratorConfig, "authEnabled" | "databaseDialect">
): Record<string, string> => {
  const authSchemaFile = renderAuthSchemaFile(
    config.databaseDialect,
    config.authEnabled
  );

  return {
    "drizzle.config.ts": `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${getDrizzleDialect(config.databaseDialect)}",
  dbCredentials: {
${renderDrizzleCredentials(config.databaseDialect)}
  },
});
`,
    "src/db/core-schema.ts": renderCoreSchemaFile(config.databaseDialect),
    "src/db/schema.ts": renderComposedSchemaFile(),
    "src/db/auth-schema.ts": authSchemaFile,
    "src/db/plugins/schema.ts": "export const pluginSchema = {};\n",
  };
};

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
    secretOverrides.set(
      "GOODCHAT_AUTH_SECRET",
      randomBytes(24).toString("hex")
    );
  }
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
  imports.push('import { createGoodchat } from "@goodchat/core";');
  imports.push('import { schema } from "./db/schema";');
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
    'mysql({ connectionString: process.env.DATABASE_URL || "", schema })';
  if (config.databaseDialect === "sqlite") {
    databaseExpression =
      'sqlite({ path: process.env.DATABASE_URL || "./goodchat.db", schema })';
  }
  if (config.databaseDialect === "postgres") {
    databaseExpression =
      'postgres({ connectionString: process.env.DATABASE_URL || "", schema })';
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
  entries.push("  auth: {");
  entries.push(`    enabled: ${config.authEnabled},`);
  entries.push('    mode: "password",');
  entries.push("    localChatPublic: false,");
  if (config.authEnabled) {
    entries.push("    password: process.env.GOODCHAT_DASHBOARD_PASSWORD,");
  }
  entries.push("  },");
  entries.push(`  database: ${databaseExpression},`);
  entries.push(
    '  isServerless: process.env.SERVERLESS === "true" || process.env.VERCEL === "1",'
  );

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

  if (input.databaseDialect === "sqlite") {
    dependencies["@goodchat/adapter-sqlite"] = formatPublishedVersion(
      dependencyManifest["@goodchat/adapter-sqlite"],
      "^0.0.1"
    );
  }
  if (input.databaseDialect === "postgres") {
    dependencies["@goodchat/adapter-postgres"] = formatPublishedVersion(
      dependencyManifest["@goodchat/adapter-postgres"],
      "^0.0.1"
    );
  }
  if (input.databaseDialect === "mysql") {
    dependencies["@goodchat/adapter-mysql"] = formatPublishedVersion(
      dependencyManifest["@goodchat/adapter-mysql"],
      "^0.0.1"
    );
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": TYPES_BUN_VERSION,
    "drizzle-kit": DRIZZLE_KIT_VERSION,
    tsdown: TSDOWN_VERSION,
    typescript: TYPESCRIPT_VERSION,
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
  const schemaFiles = renderDbSchemaArtifacts({
    authEnabled: input.config.authEnabled,
    databaseDialect: input.config.databaseDialect,
  });
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
    ...Object.entries(schemaFiles).map(([path, content]) => ({
      path,
      content,
    })),
  ];
};
