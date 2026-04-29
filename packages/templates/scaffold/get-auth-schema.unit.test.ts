import { describe, expect, it } from "vitest";
import { getAuthSchema } from "./get-auth-schema";

describe("getAuthSchema", () => {
  it("returns generated auth schema when auth is disabled", () => {
    const schema = getAuthSchema({ authEnabled: false, dialect: "sqlite" });
    expect(schema).toContain('sqliteTable("user"');
    expect(schema).toContain("export const authSchema = {");
  });

  it("returns generated auth schema for sqlite when enabled", () => {
    const schema = getAuthSchema({ authEnabled: true, dialect: "sqlite" });
    expect(schema).toContain('sqliteTable("user"');
    expect(schema).toContain("export const authSchema = {");
  });
});
