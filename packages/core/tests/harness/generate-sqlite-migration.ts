import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emitAuthDrizzleSchema,
  emitCoreDrizzleSchema,
} from "@goodchat/storage/scaffold/schema-foundation";

const runCommandOrThrow = (input: {
  args: string[];
  command: string;
  cwd: string;
}): { stderr: string; stdout: string } => {
  const result = spawnSync(input.command, input.args, {
    cwd: input.cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0) {
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
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
  const schemaDirectory = join(tempDirectory, "schema");
  const outDirectory = join(tempDirectory, "drizzle");

  await mkdir(schemaDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      join(schemaDirectory, "core.ts"),
      emitCoreDrizzleSchema("sqlite")
    ),
    writeFile(
      join(schemaDirectory, "auth.ts"),
      emitAuthDrizzleSchema("sqlite")
    ),
  ]);

  const drizzleOutput = runCommandOrThrow({
    command: "bunx",
    args: [
      "drizzle-kit",
      "generate",
      "--dialect",
      "sqlite",
      "--schema",
      `${schemaDirectory}/*.ts`,
      "--out",
      outDirectory,
    ],
    cwd: repositoryRoot,
  });

  const files = await readdir(outDirectory);
  const migrationFileName = files.find((fileName) => fileName.endsWith(".sql"));
  if (!migrationFileName) {
    throw new Error(
      [
        "drizzle-kit did not generate a SQLite migration file.",
        `Generated entries: ${files.join(", ")}`,
        `stdout: ${drizzleOutput.stdout}`,
        `stderr: ${drizzleOutput.stderr}`,
      ].join("\n")
    );
  }

  return {
    migrationsFolder: outDirectory,
    tempDirectory,
  };
};
