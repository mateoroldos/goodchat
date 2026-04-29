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

    expect(drizzleConfig).toContain('dialect: "sqlite"');
    expect(schema).toContain('sqliteTable("threads"');
    expect(schema).toContain("export const coreSchema = {");
    expect(schema).toContain("export const authSchema = {};");
    expect(schema).toContain("export const schema = {");
  });

  it("fails in check mode when generated artifacts drift", async () => {
    const projectRoot = await createTempProject("sqlite");
    await runDbSchemaSync({ cwd: projectRoot, check: false });
    await writeFile(join(projectRoot, "src/db/schema.ts"), "stale\n", "utf8");

    await expect(
      runDbSchemaSync({ cwd: projectRoot, check: true })
    ).rejects.toThrow("src/db/schema.ts is out of date");
  });

  it("passes in check mode when generated artifacts are in sync", async () => {
    const projectRoot = await createTempProject("postgres");
    await runDbSchemaSync({ cwd: projectRoot, check: false });

    await expect(
      runDbSchemaSync({ cwd: projectRoot, check: true })
    ).resolves.toBeUndefined();
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

  it("includes plugin table in schema when plugin declares schema", async () => {
    const projectRoot = await createTempProject("sqlite");
    await writeFile(
      join(projectRoot, "src/goodchat.ts"),
      `export const goodchat = {
  database: { dialect: "sqlite" as const },
  auth: { enabled: false, mode: "password" as const, webChatPublic: false },
  plugins: [
    {
      name: "my-plugin",
      schema: {
        todos: {
          columns: {
            title: { type: "string", required: true },
            done: { type: "boolean", required: false },
          },
        },
      },
    },
  ],
};\n`,
      "utf8"
    );

    await runDbSchemaSync({ cwd: projectRoot, check: false });

    const schema = await readFile(
      join(projectRoot, "src/db/schema.ts"),
      "utf8"
    );

    expect(schema).toContain('sqliteTable("todos"');
    expect(schema).toContain('text("title")');
  });

  it("detects drift when plugin table is missing from schema", async () => {
    const projectRoot = await createTempProject("sqlite");
    await runDbSchemaSync({ cwd: projectRoot, check: false });
    // Add a plugin after initial sync — schema.ts is now stale
    await writeFile(
      join(projectRoot, "src/goodchat.ts"),
      `export const goodchat = {
  database: { dialect: "sqlite" as const },
  auth: { enabled: false, mode: "password" as const, webChatPublic: false },
  plugins: [{ name: "p", schema: { extra: { columns: { val: { type: "string" } } } } }],
};\n`,
      "utf8"
    );

    await expect(
      runDbSchemaSync({ cwd: projectRoot, check: true })
    ).rejects.toThrow("src/db/schema.ts is out of date");
  });

  it("generates auth tables in schema when auth is enabled", async () => {
    const projectRoot = await createTempProject("sqlite");
    await writeFile(
      join(projectRoot, "src/goodchat.ts"),
      'export const goodchat = { database: { dialect: "sqlite" as const }, auth: { enabled: true, mode: "password" as const, webChatPublic: false, password: "secret" } };\n',
      "utf8"
    );

    await runDbSchemaSync({ cwd: projectRoot, check: false });

    const schema = await readFile(
      join(projectRoot, "src/db/schema.ts"),
      "utf8"
    );

    expect(schema).toContain('sqliteTable("user"');
    expect(schema).toContain("export const authSchema = {");
  });
});
