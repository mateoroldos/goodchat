import { describe, it } from "bun:test";
import { createTestDatabase } from "../utils";

describe("database bootstrap", () => {
  it("creates a working database instance", () => {
    createTestDatabase();
  });
});
