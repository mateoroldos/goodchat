import { describe, expect, it } from "vitest";
import {
  emitSchemaByDialect,
  renderAssetFile,
} from "./build-db-schema-template-assets";

describe("build db schema template assets", () => {
  it("db schema template assets are produced from core dsl emitters and auth import pipeline", async () => {
    const coreTemplates = await emitSchemaByDialect({
      emitDialectSchema: (dialect) => `core-${dialect}`,
    });
    const authTemplates = await emitSchemaByDialect({
      emitDialectSchema: (dialect) => `auth-${dialect}`,
    });

    const rendered = renderAssetFile({ authTemplates, coreTemplates });

    expect(rendered).toContain('"sqlite": "core-sqlite"');
    expect(rendered).toContain('"sqlite": "auth-sqlite"');
  });

  it("generated template maps include core and auth for all dialects", async () => {
    const coreTemplates = await emitSchemaByDialect({
      emitDialectSchema: (dialect) => `core-${dialect}`,
    });
    const authTemplates = await emitSchemaByDialect({
      emitDialectSchema: (dialect) => `auth-${dialect}`,
    });

    expect(Object.keys(coreTemplates)).toEqual(["sqlite", "postgres", "mysql"]);
    expect(Object.keys(authTemplates)).toEqual(["sqlite", "postgres", "mysql"]);
  });
});
