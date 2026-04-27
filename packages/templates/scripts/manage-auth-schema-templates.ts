import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "bun";

type Dialect = "sqlite" | "postgres" | "mysql";

const PACKAGE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  ".."
);
const BETTER_AUTH_CLI_VERSION = "1.3.4";

const DIALECTS = [
  "sqlite",
  "postgres",
  "mysql",
] as const satisfies readonly Dialect[];

const DIALECT_CONFIG_PATHS = {
  sqlite: "scripts/auth-schema/sqlite-auth.config.js",
  postgres: "scripts/auth-schema/postgres-auth.config.js",
  mysql: "scripts/auth-schema/mysql-auth.config.js",
} as const satisfies Record<Dialect, string>;

const DIALECT_TARGET_PATHS = {
  sqlite: "schema/auth/sqlite.ts",
  postgres: "schema/auth/postgres.ts",
  mysql: "schema/auth/mysql.ts",
} as const satisfies Record<Dialect, string>;

const AUTH_SCHEMA_EXPORT_BLOCK = `

export const authSchema = {
  user,
  session,
  account,
  verification,
};
`;
const UNUSED_POSTGRES_INTEGER_IMPORT_REGEX = /,\s*integer\s*,/;
const UNUSED_MYSQL_INT_IMPORT_REGEX = /,\s*int\s*,/;

const logInfo = (message: string): void => {
  console.log(`[INFO] ${message}`);
};

const logSuccess = (message: string): void => {
  console.log(`[OK] ${message}`);
};

const logWarn = (message: string): void => {
  console.warn(`[WARN] ${message}`);
};

const logError = (message: string): void => {
  console.error(`[ERR] ${message}`);
};

const normalizeGeneratedSchema = (dialect: Dialect, source: string): string => {
  let content = source;

  if (dialect === "postgres") {
    content = content.replace(UNUSED_POSTGRES_INTEGER_IMPORT_REGEX, ",");
  }

  if (dialect === "mysql") {
    content = content.replace(UNUSED_MYSQL_INT_IMPORT_REGEX, ",");
  }

  const trimmed = content.trimEnd();
  if (trimmed.includes("export const authSchema")) {
    return `${trimmed}\n`;
  }

  return `${trimmed}${AUTH_SCHEMA_EXPORT_BLOCK}`;
};

const runCommand = async (input: {
  args: string[];
  cwd: string;
}): Promise<void> => {
  const child = spawn(["bun", ...input.args], {
    cwd: input.cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (code === 0) {
    return;
  }

  throw new Error(
    [`Command failed with exit code ${code}.`, stdout.trim(), stderr.trim()]
      .filter((line) => line.length > 0)
      .join("\n")
  );
};

const generateForDialect = async (input: {
  dialect: Dialect;
  outputPath: string;
}): Promise<void> => {
  await runCommand({
    cwd: PACKAGE_ROOT,
    args: [
      "x",
      `@better-auth/cli@${BETTER_AUTH_CLI_VERSION}`,
      "generate",
      "--yes",
      "--config",
      DIALECT_CONFIG_PATHS[input.dialect],
      "--output",
      input.outputPath,
    ],
  });
};

const readTextOrNull = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const parseArguments = (): { check: boolean } => {
  return {
    check: process.argv.includes("--check"),
  };
};

const run = async (): Promise<void> => {
  const options = parseArguments();
  const mode = options.check ? "check" : "generate";
  logInfo(
    `Starting auth schema ${mode} for ${DIALECTS.length} dialects (better-auth cli v${BETTER_AUTH_CLI_VERSION}).`
  );

  const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-auth-schema-"));
  logInfo(`Using temporary directory: ${tempDirectory}`);

  try {
    const generatedByDialect: Array<{
      dialect: Dialect;
      generatedContent: string;
      targetPath: string;
    }> = [];

    for (const dialect of DIALECTS) {
      logInfo(`Generating Better Auth schema for ${dialect}...`);
      const generatedPath = join(tempDirectory, `${dialect}.ts`);
      await generateForDialect({
        dialect,
        outputPath: generatedPath,
      });

      generatedByDialect.push({
        dialect,
        generatedContent: normalizeGeneratedSchema(
          dialect,
          await readFile(generatedPath, "utf8")
        ),
        targetPath: resolve(PACKAGE_ROOT, DIALECT_TARGET_PATHS[dialect]),
      });

      logSuccess(`Generated and normalized ${dialect} auth schema.`);
    }

    if (options.check) {
      const driftErrors: string[] = [];

      for (const generatedSchema of generatedByDialect) {
        const currentContent = await readTextOrNull(generatedSchema.targetPath);
        if (currentContent !== generatedSchema.generatedContent) {
          logWarn(
            `${DIALECT_TARGET_PATHS[generatedSchema.dialect]} is out of date.`
          );
          driftErrors.push(
            `${DIALECT_TARGET_PATHS[generatedSchema.dialect]} is out of date. Run: bun run schema:auth:generate`
          );
          continue;
        }

        logSuccess(
          `${DIALECT_TARGET_PATHS[generatedSchema.dialect]} is up to date.`
        );
      }

      if (driftErrors.length > 0) {
        logError(
          `Auth schema drift detected in ${driftErrors.length} file(s).`
        );
        throw new Error(driftErrors.join("\n"));
      }

      logSuccess("All auth schema templates are up to date.");

      return;
    }

    for (const generatedSchema of generatedByDialect) {
      await writeFile(
        generatedSchema.targetPath,
        generatedSchema.generatedContent,
        "utf8"
      );
      logSuccess(`Updated ${DIALECT_TARGET_PATHS[generatedSchema.dialect]}.`);
    }

    logSuccess("Auth schema templates generated successfully.");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
    logInfo("Cleaned temporary files.");
  }
};

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logError(message);
  process.exitCode = 1;
}
