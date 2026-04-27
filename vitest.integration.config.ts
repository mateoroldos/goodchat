import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
      "packages/storage/tests/sqlite/**/*.integration.test.ts",
    ],
    environment: "node",
    clearMocks: true,
  },
});
