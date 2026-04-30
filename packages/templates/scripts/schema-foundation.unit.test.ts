import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORE_SCHEMA_DSL,
  emitCoreDrizzleSchema,
  normalizeAuthModelFromBetterAuthImport,
  normalizeBetterAuthSchemaText,
} from "./schema-foundation";

const readStorageSchema = async (relativePath: string): Promise<string> => {
  return readFile(resolve(process.cwd(), "packages/storage", relativePath), "utf8");
};

describe("schema foundation", () => {
  it("dsl model for core schema is deterministic", () => {
    const firstRender = JSON.stringify(CORE_SCHEMA_DSL);
    const secondRender = JSON.stringify(CORE_SCHEMA_DSL);
    expect(secondRender).toBe(firstRender);
  });

  it("better-auth auth model normalization is deterministic", () => {
    const source = `import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";\n\nexport const user = pgTable("user", { id: text("id").primaryKey() });\n`;
    const firstRender = normalizeBetterAuthSchemaText("postgres", source);
    const secondRender = normalizeBetterAuthSchemaText("postgres", source);
    expect(secondRender).toBe(firstRender);
  });

  it("sqlite core drizzle schema is generated from dsl", async () => {
    const generated = emitCoreDrizzleSchema("sqlite");
    const current = await readStorageSchema("schema/sqlite.ts");
    expect(generated).toBe(current);
  });

  it("postgres core drizzle schema is generated from dsl", async () => {
    const generated = emitCoreDrizzleSchema("postgres");
    const current = await readStorageSchema("schema/postgres.ts");
    expect(generated).toBe(current);
  });

  it("mysql core drizzle schema is generated from dsl", async () => {
    const generated = emitCoreDrizzleSchema("mysql");
    const current = await readStorageSchema("schema/mysql.ts");
    expect(generated).toBe(current);
  });

  it("sqlite auth drizzle schema is generated from better-auth import", async () => {
    const source = await readStorageSchema("schema/auth/sqlite.ts");
    const generated = normalizeAuthModelFromBetterAuthImport({
      dialect: "sqlite",
      source,
    });
    expect(generated).toBe(source);
  });

  it("postgres auth drizzle schema is generated from better-auth import", async () => {
    const source = await readStorageSchema("schema/auth/postgres.ts");
    const generated = normalizeAuthModelFromBetterAuthImport({
      dialect: "postgres",
      source,
    });
    expect(generated).toBe(source);
  });

  it("mysql auth drizzle schema is generated from better-auth import", async () => {
    const source = await readStorageSchema("schema/auth/mysql.ts");
    const generated = normalizeAuthModelFromBetterAuthImport({
      dialect: "mysql",
      source,
    });
    expect(generated).toBe(source);
  });
});
