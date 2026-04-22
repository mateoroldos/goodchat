import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { sourcemap: true },
  hash: false,
  unbundle: true,
  sourcemap: true,
  clean: true,
  outDir: "./dist",
});
