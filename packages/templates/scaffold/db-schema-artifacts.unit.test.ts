import { describe, expect, it } from "vitest";
import { renderDbSchemaArtifacts } from "./db-schema-artifacts";

describe("renderDbSchemaArtifacts", () => {
  it("emits single drizzle import line for auth-disabled sqlite", async () => {
    const files = await renderDbSchemaArtifacts({
      authEnabled: false,
      dialect: "sqlite",
    });
    const schema = files["src/db/schema.ts"];
    expect(schema).toContain(
      'import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";'
    );
    expect(schema).toContain('sqliteTable("user"');
  });

  it("includes auth tables when enabled", async () => {
    const files = await renderDbSchemaArtifacts({
      authEnabled: true,
      dialect: "postgres",
    });
    const schema = files["src/db/schema.ts"];
    expect(schema).toContain('pgTable("user"');
    expect(schema).toContain("export const authSchema = {");
    expect(schema).toContain("export const coreSchema = {");
    expect(schema).toContain("export const schema = {");
  });

  it("includes plugin tables in coreSchema", async () => {
    const files = await renderDbSchemaArtifacts({
      authEnabled: false,
      dialect: "mysql",
      plugins: [
        {
          schema: {
            todos: {
              columns: { title: { type: "string", required: true } },
            },
          },
        },
      ],
    });
    const schema = files["src/db/schema.ts"];
    expect(schema).toContain('mysqlTable("todos"');
    expect(schema).toContain('text("title")');
  });
});
