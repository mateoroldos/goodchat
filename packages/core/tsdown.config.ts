import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    types: "./src/types.ts",
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
