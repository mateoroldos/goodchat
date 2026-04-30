import { describe, expect, it } from "vitest";
import {
  CORE_SCHEMA_DSL,
  normalizeBetterAuthSchemaText,
} from "./schema-foundation";

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
});
