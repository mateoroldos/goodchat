import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { databaseDialectSchema } from "@goodchat/contracts/config/models";
import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import type { GoodchatPluginDefinitionAny } from "@goodchat/contracts/plugins/types";
import { isPluginFactory } from "@goodchat/contracts/plugins/types";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import { renderDbSchemaArtifacts } from "@goodchat/storage/scaffold/db-schema-artifacts";
import { createJiti } from "jiti";

export interface DbSchemaSyncOptions {
  check: boolean;
  configPath?: string;
  cwd: string;
  dialect?: string;
  json?: boolean;
}

const GOODCHAT_CONFIG_PATH = "src/goodchat.ts";

const readTextFileOrNull = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const ensureParentDirectory = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

const resolveConfigPath = (cwd: string, configPath: string): string => {
  if (isAbsolute(configPath)) {
    return configPath;
  }
  return join(cwd, configPath);
};

interface LoadedGoodchatConfig {
  auth?: { enabled?: boolean };
  database?: {
    dialect?: unknown;
  };
  plugins?: readonly unknown[];
}

export const DB_SCHEMA_SYNC_ISSUE_CATEGORIES = [
  "ARTIFACT_STALE",
  "MISSING_ARTIFACT",
  "UNEXPECTED_ARTIFACT",
  "PLUGIN_SCHEMA_CONFLICT",
  "MIGRATION_HISTORY_DIVERGENCE",
  "NON_DETERMINISTIC_INPUT",
] as const;

export type DbSchemaSyncIssueCategory =
  (typeof DB_SCHEMA_SYNC_ISSUE_CATEGORIES)[number];

interface DbSchemaSyncIssue {
  actualHash?: string;
  category: DbSchemaSyncIssueCategory;
  expectedHash?: string;
  message: string;
  path?: string;
}

interface DbSchemaSyncCheckReport {
  issues: DbSchemaSyncIssue[];
  ok: boolean;
}

const hashText = (text: string): string => {
  return createHash("sha256").update(text).digest("hex");
};

const readJsonFileOrNull = async <T>(path: string): Promise<T | null> => {
  const content = await readTextFileOrNull(path);
  if (!content) {
    return null;
  }

  return JSON.parse(content) as T;
};

const readDirectoryNamesOrEmpty = async (path: string): Promise<string[]> => {
  try {
    return await readdir(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const normalizePluginName = (pluginName: string): string => {
  return pluginName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const resolvePluginDefinition = (
  plugin: unknown
): GoodchatPluginDefinitionAny | null => {
  if (isPluginFactory(plugin)) {
    return plugin();
  }
  if (
    plugin &&
    typeof plugin === "object" &&
    "create" in plugin &&
    typeof plugin.create === "function" &&
    "name" in plugin &&
    typeof plugin.name === "string"
  ) {
    return plugin as GoodchatPluginDefinitionAny;
  }
  return null;
};

const resolvePluginPrefix = (definition: {
  key?: unknown;
  name: string;
}): string => {
  const pluginPrefix = normalizePluginName(definition.name);
  if (!pluginPrefix) {
    throw new Error(`Plugin "${definition.name}" has an invalid name.`);
  }

  const keyValue =
    typeof definition.key === "string" ? definition.key : undefined;
  const keySuffix = keyValue ? normalizePluginName(keyValue) : "";
  return keySuffix ? `${pluginPrefix}_${keySuffix}` : pluginPrefix;
};

const resolvePluginSchemas = (plugins: readonly unknown[] | undefined) => {
  if (!plugins || plugins.length === 0) {
    return [];
  }

  const declarations: {
    pluginName: string;
    tables: readonly SchemaTableDeclaration[];
  }[] = [];
  const seen = new Map<string, string>();

  for (const plugin of plugins) {
    const definition = resolvePluginDefinition(plugin);
    const schema =
      definition && "schema" in definition ? definition.schema : undefined;
    if (!(definition && schema) || schema.length === 0) {
      continue;
    }

    const prefix = resolvePluginPrefix(definition);

    const localNames = new Set(schema.map((table) => table.tableName));
    const tables = schema.map((table) => {
      const tableName = `${prefix}_${table.tableName}`;
      const owner = seen.get(tableName);
      if (owner) {
        const conflict = new Error(
          `Plugin schema table name collision: "${tableName}" is declared by both "${owner}" and "${definition.name}".`
        ) as Error & { category?: DbSchemaSyncIssueCategory };
        conflict.category = "PLUGIN_SCHEMA_CONFLICT";
        throw conflict;
      }
      seen.set(tableName, definition.name);

      return {
        ...table,
        tableName,
        relations: table.relations?.map((relation) => ({
          ...relation,
          targetTable: localNames.has(relation.targetTable)
            ? `${prefix}_${relation.targetTable}`
            : relation.targetTable,
        })),
      };
    });

    declarations.push({
      pluginName: definition.name,
      tables,
    });
  }

  return declarations;
};

interface DrizzleJournalEntry {
  idx: number;
  tag: string;
}

interface DrizzleJournal {
  entries: DrizzleJournalEntry[];
}

const getMigrationDivergenceIssues = async (cwd: string) => {
  const issues: DbSchemaSyncIssue[] = [];
  const journalPath = join(cwd, "drizzle/meta/_journal.json");
  const journal = await readJsonFileOrNull<DrizzleJournal>(journalPath);
  if (!journal) {
    return issues;
  }

  if (!Array.isArray(journal.entries)) {
    issues.push({
      category: "MIGRATION_HISTORY_DIVERGENCE",
      message: "drizzle/meta/_journal.json has invalid entries shape.",
      path: "drizzle/meta/_journal.json",
    });
    return issues;
  }

  for (const [index, entry] of journal.entries.entries()) {
    if (entry.idx !== index) {
      issues.push({
        category: "MIGRATION_HISTORY_DIVERGENCE",
        message: `Migration journal index mismatch at position ${index}. Expected ${index}, found ${entry.idx}.`,
        path: "drizzle/meta/_journal.json",
      });
    }
    const sqlPath = join(cwd, "drizzle", `${entry.tag}.sql`);
    const snapshotPath = join(
      cwd,
      "drizzle/meta",
      `${entry.idx.toString().padStart(4, "0")}_snapshot.json`
    );
    const [sql, snapshot] = await Promise.all([
      readTextFileOrNull(sqlPath),
      readTextFileOrNull(snapshotPath),
    ]);
    if (!sql) {
      issues.push({
        category: "MIGRATION_HISTORY_DIVERGENCE",
        message: `Migration SQL file is missing for journal entry ${entry.tag}.`,
        path: `drizzle/${entry.tag}.sql`,
      });
    }
    if (!snapshot) {
      issues.push({
        category: "MIGRATION_HISTORY_DIVERGENCE",
        message: `Migration snapshot is missing for journal entry ${entry.idx}.`,
        path: `drizzle/meta/${entry.idx.toString().padStart(4, "0")}_snapshot.json`,
      });
    }
  }

  return issues;
};

const buildCheckReport = async (input: {
  cwd: string;
  expectedFiles: Record<string, string>;
}) => {
  const expectedPaths = Object.keys(input.expectedFiles).sort();
  const fileResults = await Promise.all(
    expectedPaths.map(async (path) => {
      const absolutePath = join(input.cwd, path);
      const content = await readTextFileOrNull(absolutePath);
      return { content, path };
    })
  );

  const issues: DbSchemaSyncIssue[] = [];
  for (const file of fileResults) {
    const expectedContent = input.expectedFiles[file.path];
    if (expectedContent === undefined) {
      issues.push({
        category: "NON_DETERMINISTIC_INPUT",
        message: `${file.path} could not be resolved in expected artifact set.`,
        path: file.path,
      });
      continue;
    }
    if (file.content === null) {
      issues.push({
        category: "MISSING_ARTIFACT",
        message: `${file.path} is missing. Run: goodchat db schema sync`,
        path: file.path,
      });
      continue;
    }
    if (file.content !== expectedContent) {
      const expectedHash = hashText(expectedContent);
      const actualHash = hashText(file.content);
      issues.push({
        actualHash,
        category: "ARTIFACT_STALE",
        expectedHash,
        message: `${file.path} is out of date. Run: goodchat db schema sync`,
        path: file.path,
      });
    }
  }

  const generatedPluginFiles = await readDirectoryNamesOrEmpty(
    join(input.cwd, "src/db/plugins")
  );
  for (const pluginFile of generatedPluginFiles.sort()) {
    const relativePath = `src/db/plugins/${pluginFile}`;
    if (!(relativePath in input.expectedFiles)) {
      issues.push({
        category: "UNEXPECTED_ARTIFACT",
        message: `${relativePath} is unexpected generated artifact. Remove it or update schema sync inputs.`,
        path: relativePath,
      });
    }
  }

  issues.push(...(await getMigrationDivergenceIssues(input.cwd)));
  return { issues, ok: issues.length === 0 } satisfies DbSchemaSyncCheckReport;
};

const renderHumanIssues = (issues: readonly DbSchemaSyncIssue[]): string => {
  return issues
    .map((issue) => {
      return `[${issue.category}] ${issue.message}`;
    })
    .join("\n");
};

const loadGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<LoadedGoodchatConfig> => {
  const configPath = resolveConfigPath(input.cwd, input.configPath);
  const exists = await readTextFileOrNull(configPath);
  if (!exists) {
    throw new Error(`Missing ${input.configPath}.`);
  }

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false,
  });

  const moduleExports = (await jiti.import(configPath)) as {
    goodchat?: LoadedGoodchatConfig;
  };

  const exported = moduleExports.goodchat;
  if (exported && typeof exported === "object") {
    return exported;
  }

  throw new Error(
    `Could not load goodchat config from ${input.configPath}. Ensure you export a goodchat instance created with createGoodchat().`
  );
};

const resolveDialectFromGoodchatConfig = (input: {
  configPath: string;
  config: LoadedGoodchatConfig;
}): DatabaseDialect => {
  const parsedDialect = databaseDialectSchema.safeParse(
    input.config.database?.dialect
  );
  if (parsedDialect.success) {
    return parsedDialect.data;
  }

  throw new Error(
    `Could not resolve a valid database dialect from ${input.configPath}. Export goodchat.database with a supported dialect.`
  );
};

const resolveDialect = (options: {
  config: LoadedGoodchatConfig;
  configPath: string;
  dialect?: string;
}): DatabaseDialect => {
  if (options.dialect) {
    const parsed = databaseDialectSchema.safeParse(options.dialect);
    if (!parsed.success) {
      throw new Error(
        `Invalid --dialect value: ${options.dialect}. Expected one of sqlite, postgres, mysql.`
      );
    }
    return parsed.data;
  }

  return resolveDialectFromGoodchatConfig({
    config: options.config,
    configPath: options.configPath,
  });
};

export const runDbSchemaSync = async (
  options: DbSchemaSyncOptions
): Promise<void> => {
  const configPath = options.configPath ?? GOODCHAT_CONFIG_PATH;
  const config = await loadGoodchatConfig({
    configPath,
    cwd: options.cwd,
  });
  const dialect = resolveDialect({
    dialect: options.dialect,
    config,
    configPath,
  });
  let pluginDeclarations: ReturnType<typeof resolvePluginSchemas> = [];
  try {
    pluginDeclarations = resolvePluginSchemas(config.plugins);
  } catch (error) {
    const category =
      error instanceof Error && "category" in error
        ? (error.category as DbSchemaSyncIssueCategory)
        : "NON_DETERMINISTIC_INPUT";
    const issue = {
      category,
      message:
        error instanceof Error ? error.message : "Unknown plugin schema error.",
    } satisfies DbSchemaSyncIssue;
    throw new Error(
      options.json
        ? JSON.stringify({ issues: [issue], ok: false })
        : `[${issue.category}] ${issue.message}`
    );
  }

  const expectedFiles = await renderDbSchemaArtifacts({
    cwd: options.cwd,
    dialect,
    pluginDeclarations,
  });

  if (options.check) {
    const report = await buildCheckReport({
      cwd: options.cwd,
      expectedFiles,
    });
    if (!report.ok) {
      throw new Error(
        options.json ? JSON.stringify(report) : renderHumanIssues(report.issues)
      );
    }
    return;
  }

  for (const [path, content] of Object.entries(expectedFiles)) {
    const absolutePath = join(options.cwd, path);
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, content, "utf8");
  }
};
