import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "bun";

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
  const child = spawn([command, ...args], {
    cwd: targetDir,
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

  const output = `${stdout}${stderr}`.trim();
  throw new Error(
    output ||
      `${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`
  );
};
