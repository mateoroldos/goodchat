import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: [
      "**/node_modules/**",
      "packages/adapter-sqlite/tests/integration/**/*.integration.test.ts",
    ],
    environment: "node",
    clearMocks: true,
  },
});
