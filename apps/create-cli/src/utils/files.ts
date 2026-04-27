import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const writeFiles = async (
  targetDir: string,
  files: { path: string; content: string }[]
): Promise<void> => {
  for (const file of files) {
    const filePath = join(targetDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf8");
  }
};

export const runCommand = async (
  targetDir: string,
  command: string,
  args: string[]
): Promise<void> => {
  const child = spawn(command, args, {
    cwd: targetDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });

  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const errorEvent = once(child, "error").then(([error]) => {
    throw error;
  });

  const closeEvent = once(child, "close").then(
    ([code]) => code as number | null
  );

  const code = await Promise.race([closeEvent, errorEvent]);

  if (code === 0) {
    return;
  }

  const output = `${stdout}${stderr}`.trim();
  throw new Error(
    output ||
      `${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`
  );
};
