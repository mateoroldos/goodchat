import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../utils";

const connectionString = process.env.MYSQL_TEST_URL;
const describeMysql = connectionString ? describe : describe.skip;

const withDatabase = async <T>(
  fn: (
    database: Awaited<ReturnType<typeof createTestDatabase>>["database"]
  ) => Promise<T> | T
) => {
  if (!connectionString) {
    throw new Error("MYSQL_TEST_URL is required.");
  }
  const { database, cleanup } = await createTestDatabase(connectionString);
  try {
    return await fn(database);
  } finally {
    await cleanup();
  }
};

describeMysql("database bootstrap", () => {
  it("creates a working database instance", async () => {
    await withDatabase((database) => {
      expect(database.dialect).toBe("mysql");
    });
  });
});
