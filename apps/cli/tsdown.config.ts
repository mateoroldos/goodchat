import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: "#!/usr/bin/env node",
  outDir: "./dist",
});
