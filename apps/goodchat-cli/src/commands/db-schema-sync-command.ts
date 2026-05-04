import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { databaseDialectSchema } from "@goodchat/contracts/config/models";
import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import {
  isPluginDefinition,
  isPluginFactory,
} from "@goodchat/contracts/plugins/types";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import { renderDbSchemaArtifacts } from "@goodchat/storage/scaffold/db-schema-artifacts";
import { createJiti } from "jiti";

export interface DbSchemaSyncOptions {
  check: boolean;
  configPath?: string;
  cwd: string;
  dialect?: string;
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

const normalizePluginName = (pluginName: string): string => {
  return pluginName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
    let definition: unknown = null;
    if (isPluginFactory(plugin)) {
      definition = plugin();
    } else if (isPluginDefinition(plugin)) {
      definition = plugin;
    }
    const schema =
      definition && "schema" in definition ? definition.schema : undefined;
    if (!(definition && schema) || schema.length === 0) {
      continue;
    }

    const prefix = normalizePluginName(definition.name);
    if (!prefix) {
      throw new Error(`Plugin "${definition.name}" has an invalid name.`);
    }

    const localNames = new Set(schema.map((table) => table.tableName));
    const tables = schema.map((table) => {
      const tableName = `${prefix}_${table.tableName}`;
      const owner = seen.get(tableName);
      if (owner) {
        throw new Error(
          `Plugin schema table name collision: "${tableName}" is declared by both "${owner}" and "${definition.name}".`
        );
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
  const expectedFiles = await renderDbSchemaArtifacts({
    cwd: options.cwd,
    dialect,
    pluginDeclarations: resolvePluginSchemas(config.plugins),
  });

  const existingFiles = await Promise.all(
    Object.keys(expectedFiles).map(async (path) => {
      const absolutePath = join(options.cwd, path);
      const content = await readTextFileOrNull(absolutePath);
      return { content, path };
    })
  );

  const driftErrors: string[] = [];
  for (const file of existingFiles) {
    const expectedContent =
      expectedFiles[file.path as keyof typeof expectedFiles];
    if (file.content !== expectedContent) {
      driftErrors.push(
        `${file.path} is out of date. Run: goodchat db schema sync`
      );
    }
  }

  if (options.check) {
    if (driftErrors.length > 0) {
      throw new Error(driftErrors.join("\n"));
    }
    return;
  }

  for (const [path, content] of Object.entries(expectedFiles)) {
    const absolutePath = join(options.cwd, path);
    await ensureParentDirectory(absolutePath);
    await writeFile(absolutePath, content, "utf8");
  }
};
