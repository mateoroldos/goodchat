import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../utils";

const connectionString = process.env.POSTGRES_TEST_URL;
const describePostgres = connectionString ? describe : describe.skip;

const withDatabase = async <T>(
  fn: (
    database: Awaited<ReturnType<typeof createTestDatabase>>["database"]
  ) => Promise<T> | T
) => {
  if (!connectionString) {
    throw new Error("POSTGRES_TEST_URL is required.");
  }
  const { database, cleanup } = await createTestDatabase(connectionString);
  try {
    return await fn(database);
  } finally {
    await cleanup();
  }
};

describePostgres("database bootstrap", () => {
  it("creates a working database instance", async () => {
    await withDatabase((database) => {
      expect(database.dialect).toBe("postgres");
    });
  });
});
