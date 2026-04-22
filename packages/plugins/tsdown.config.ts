import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    linear: "./src/linear.ts",
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
