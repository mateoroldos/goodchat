import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { databaseDialectSchema } from "@goodchat/contracts/config/models";
import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import { renderDbSchemaArtifacts } from "@goodchat/templates/scaffold/db-schema-artifacts";
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
}

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

const resolveDialectFromGoodchatConfig = async (input: {
  configPath: string;
  cwd: string;
}): Promise<DatabaseDialect> => {
  const moduleExports = await loadGoodchatConfig(input);
  const parsedDialect = databaseDialectSchema.safeParse(
    moduleExports.database?.dialect
  );
  if (parsedDialect.success) {
    return parsedDialect.data;
  }

  throw new Error(
    `Could not resolve a valid database dialect from ${input.configPath}. Export goodchat.database with a supported dialect.`
  );
};

const resolveDialect = (options: {
  configPath: string;
  cwd: string;
  dialect?: string;
}): Promise<DatabaseDialect> => {
  if (options.dialect) {
    const parsed = databaseDialectSchema.safeParse(options.dialect);
    if (!parsed.success) {
      throw new Error(
        `Invalid --dialect value: ${options.dialect}. Expected one of sqlite, postgres, mysql.`
      );
    }
    return Promise.resolve(parsed.data);
  }

  return resolveDialectFromGoodchatConfig({
    configPath: options.configPath,
    cwd: options.cwd,
  });
};

export const runDbSchemaSync = async (
  options: DbSchemaSyncOptions
): Promise<void> => {
  const configPath = options.configPath ?? GOODCHAT_CONFIG_PATH;
  const dialect = await resolveDialect({
    dialect: options.dialect,
    configPath,
    cwd: options.cwd,
  });
  const expectedFiles = await renderDbSchemaArtifacts({
    cwd: options.cwd,
    dialect,
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
