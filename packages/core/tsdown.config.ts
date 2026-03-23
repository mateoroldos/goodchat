import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    types: "./src/types.ts",
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
