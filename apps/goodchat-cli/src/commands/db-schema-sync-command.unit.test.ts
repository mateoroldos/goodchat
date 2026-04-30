import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDbSchemaSync } from "./db-schema-sync-command";

const tempDirectories: string[] = [];

const createTempProject = async (dialect: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "goodchat-cli-test-"));
  tempDirectories.push(directory);
  await mkdir(join(directory, "src"), { recursive: true });
  await writeFile(
    join(directory, "src/goodchat.ts"),
    `export const goodchat = { database: { dialect: "${dialect}" as const }, auth: { enabled: false, mode: "password" as const, webChatPublic: false } };\n`,
    "utf8"
  );
  return directory;
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("db schema sync command", () => {
  it("creates drizzle and schema artifacts from scratch", async () => {
    const projectRoot = await createTempProject("sqlite");

    await runDbSchemaSync({ cwd: projectRoot, check: false });

    const drizzleConfig = await readFile(
      join(projectRoot, "drizzle.config.ts"),
      "utf8"
    );
    const schema = await readFile(
      join(projectRoot, "src/db/schema.ts"),
      "utf8"
    );
    const coreSchema = await readFile(
      join(projectRoot, "src/db/core-schema.ts"),
      "utf8"
    );
    const authSchema = await readFile(
      join(projectRoot, "src/db/auth-schema.ts"),
      "utf8"
    );
    const pluginSchema = await readFile(
      join(projectRoot, "src/db/plugins/schema.ts"),
      "utf8"
    );

    expect(drizzleConfig).toContain('dialect: "sqlite"');
    expect(schema).toContain('import { coreSchema } from "./core-schema";');
    expect(schema).toContain('import { authSchema } from "./auth-schema";');
    expect(schema).toContain(
      'import { pluginSchema } from "./plugins/schema";'
    );
    expect(coreSchema).toContain('sqliteTable("threads"');
    expect(schema).toContain("export const schema = {");
    expect(authSchema).toContain("export const authSchema = {");
    expect(authSchema).toContain('sqliteTable("user"');
    expect(pluginSchema).toBe("export const pluginSchema = {};\n");
  });

  it("fails in check mode when generated artifacts drift", async () => {
    const projectRoot = await createTempProject("sqlite");
    await runDbSchemaSync({ cwd: projectRoot, check: false });
    await writeFile(
      join(projectRoot, "src/db/auth-schema.ts"),
      "export const authSchema = { stale: true };\n",
      "utf8"
    );

    await expect(
      runDbSchemaSync({ cwd: projectRoot, check: true })
    ).rejects.toThrow("src/db/auth-schema.ts is out of date");
  });

  it("db schema sync check passes after sync for each dialect", async () => {
    for (const dialect of ["sqlite", "postgres", "mysql"] as const) {
      const projectRoot = await createTempProject(dialect);
      await runDbSchemaSync({ cwd: projectRoot, check: false });

      await expect(
        runDbSchemaSync({ cwd: projectRoot, check: true })
      ).resolves.toBeUndefined();
    }
  });

  it("fails when goodchat config does not define database dialect", async () => {
    const projectRoot = await createTempProject("sqlite");
    await writeFile(
      join(projectRoot, "src/goodchat.ts"),
      "export const invalid = true;\n",
      "utf8"
    );

    await expect(
      runDbSchemaSync({ cwd: projectRoot, check: false })
    ).rejects.toThrow("Could not load goodchat config from src/goodchat.ts");
  });

  it("uses --config override path when provided", async () => {
    const projectRoot = await createTempProject("sqlite");
    await writeFile(
      join(projectRoot, "src/custom-goodchat.ts"),
      'export const goodchat = { database: { dialect: "mysql" as const }, auth: { enabled: false, mode: "password" as const, webChatPublic: false } };\n',
      "utf8"
    );

    await runDbSchemaSync({
      cwd: projectRoot,
      check: false,
      configPath: "src/custom-goodchat.ts",
    });

    const drizzleConfig = await readFile(
      join(projectRoot, "drizzle.config.ts"),
      "utf8"
    );
    expect(drizzleConfig).toContain('dialect: "mysql"');
  });

  it("uses --dialect override when provided", async () => {
    const projectRoot = await createTempProject("sqlite");

    await runDbSchemaSync({
      cwd: projectRoot,
      check: false,
      dialect: "postgres",
    });

    const drizzleConfig = await readFile(
      join(projectRoot, "drizzle.config.ts"),
      "utf8"
    );
    expect(drizzleConfig).toContain('dialect: "postgresql"');
  });

  it("db schema sync always generates auth schema artifact regardless of auth enabled config", async () => {
    const projectRoot = await createTempProject("sqlite");

    await runDbSchemaSync({ cwd: projectRoot, check: false });

    const authSchema = await readFile(
      join(projectRoot, "src/db/auth-schema.ts"),
      "utf8"
    );

    expect(authSchema).toContain('sqliteTable("user"');
  });

  it("db schema sync output is byte-stable for same input", async () => {
    const projectRoot = await createTempProject("sqlite");
    await runDbSchemaSync({ cwd: projectRoot, check: false });
    const first = await readFile(
      join(projectRoot, "src/db/auth-schema.ts"),
      "utf8"
    );

    await runDbSchemaSync({ cwd: projectRoot, check: false });
    const second = await readFile(
      join(projectRoot, "src/db/auth-schema.ts"),
      "utf8"
    );

    expect(second).toBe(first);
  });
});
