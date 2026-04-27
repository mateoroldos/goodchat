import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.unit.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
    environment: "node",
    clearMocks: true,
  },
});
