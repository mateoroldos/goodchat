import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
  resolve: {
    alias: {
      "bun:sqlite": resolve(import.meta.dirname, "./src/test-bun-sqlite.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
