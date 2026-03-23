import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    linear: "./src/linear.ts",
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
