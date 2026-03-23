import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "hooks/models": "./src/hooks/models.ts",
    "hooks/types": "./src/hooks/types.ts",
    "capabilities/models": "./src/capabilities/models.ts",
    "capabilities/types": "./src/capabilities/types.ts",
    "config/models": "./src/config/models.ts",
    "config/types": "./src/config/types.ts",
    "config/utils": "./src/config/utils.ts",
    "config/messages": "./src/messages/types.ts",
    "plugins/define": "./src/plugins/define.ts",
    "plugins/models": "./src/plugins/models.ts",
    "plugins/types": "./src/plugins/types.ts",
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
