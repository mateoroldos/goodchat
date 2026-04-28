import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    linear: "./src/linear.ts",
    "rate-limit": "./src/rate-limit/index.ts",
    "rate-limit/schema/mysql": "./src/rate-limit/schemas/mysql.ts",
    "rate-limit/schema/postgres": "./src/rate-limit/schemas/postgres.ts",
    "rate-limit/schema/sqlite": "./src/rate-limit/schemas/sqlite.ts",
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
