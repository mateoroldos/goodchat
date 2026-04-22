import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    sqlite: "./src/sqlite.ts",
    postgres: "./src/postgres.ts",
    mysql: "./src/mysql.ts",
    "schema/sqlite": "./schema/sqlite.ts",
    "schema/postgres": "./schema/postgres.ts",
    "schema/mysql": "./schema/mysql.ts",
    "schema/auth/sqlite": "./schema/auth/sqlite.ts",
    "schema/auth/postgres": "./schema/auth/postgres.ts",
    "schema/auth/mysql": "./schema/auth/mysql.ts",
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
