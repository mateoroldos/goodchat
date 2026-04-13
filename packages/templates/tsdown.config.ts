import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "schema/sqlite": "./schema/sqlite.ts",
    "schema/postgres": "./schema/postgres.ts",
    "schema/mysql": "./schema/mysql.ts",
    "schema/auth/sqlite": "./schema/auth/sqlite.ts",
    "schema/auth/postgres": "./schema/auth/postgres.ts",
    "schema/auth/mysql": "./schema/auth/mysql.ts",
    "scaffold/db-schema-artifacts": "./scaffold/db-schema-artifacts.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    sourcemap: true,
  },
  hash: false,
  unbundle: true,
  sourcemap: true,
  clean: true,
  outDir: "./dist",
});
