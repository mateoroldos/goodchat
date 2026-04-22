import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "scaffold/db-schema-artifacts": "./scaffold/db-schema-artifacts.ts",
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
