import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    types: "./src/types.ts",
    "db/drizzle-generator": "./src/db/drizzle-generator.ts",
    "db/get-tables": "./src/db/get-tables.ts",
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
