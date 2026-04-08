import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runCommandOrThrow = (input: {
  args: string[];
  command: string;
  cwd: string;
}): void => {
  const result = spawnSync(input.command, input.args, {
    cwd: input.cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0) {
    return;
  }

  throw new Error(
    [
      `Command failed: ${input.command} ${input.args.join(" ")}`,
      `stdout: ${result.stdout ?? ""}`,
      `stderr: ${result.stderr ?? ""}`,
    ].join("\n")
  );
};

const resolveRepositoryRoot = (): string => {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../..");
};

export const generateSqliteMigrationFromTemplateSchemas = async (): Promise<{
  migrationsFolder: string;
  tempDirectory: string;
}> => {
  const repositoryRoot = resolveRepositoryRoot();
  const tempRoot = join(repositoryRoot, "packages/core/.tmp");
  await mkdir(tempRoot, { recursive: true });

  const tempDirectory = await mkdtemp(join(tempRoot, "core-auth-integration-"));
  const schemaPath = join(
    repositoryRoot,
    "packages/core/tests/harness/schema.ts"
  );
  const outDirectory = join(tempDirectory, "drizzle");

  runCommandOrThrow({
    command: "bunx",
    args: [
      "drizzle-kit",
      "generate",
      "--dialect",
      "sqlite",
      "--schema",
      schemaPath,
      "--out",
      outDirectory,
    ],
    cwd: repositoryRoot,
  });

  const files = await readdir(outDirectory);
  const migrationFileName = files.find((fileName) => fileName.endsWith(".sql"));
  if (!migrationFileName) {
    throw new Error(
      `drizzle-kit did not generate a SQLite migration file. Generated entries: ${files.join(", ")}`
    );
  }

  return {
    migrationsFolder: outDirectory,
    tempDirectory,
  };
};
