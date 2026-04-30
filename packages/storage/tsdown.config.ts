import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    sqlite: "./src/sqlite.ts",
    postgres: "./src/postgres.ts",
    mysql: "./src/mysql.ts",
    "internal-schema/shared": "./src/internal-schema/shared.ts",
    "scaffold/schema-foundation": "./src/scaffold/schema-foundation.ts",
    "scaffold/db-schema-artifacts": "./src/scaffold/db-schema-artifacts.ts",
  },
  format: ["esm"],
  dts: {
    sourcemap: true,
  },
  hash: false,
  unbundle: true,
  sourcemap: true,
  clean: true,
  outDir: "./dist",
});
