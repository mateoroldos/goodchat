import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createPool } from "mysql2/promise";
import { customAlphabet } from "nanoid";
import { mysqlSchema } from "../../schema/mysql";
import { mysql } from "../../src/mysql";

export interface TestDatabase {
  cleanup: () => Promise<void>;
  database: Database;
}

const randomDatabaseSuffix = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  24
);

const buildDatabaseName = () => `goodchat_test_${randomDatabaseSuffix()}`;

const buildAdminConnectionString = (connectionString: string) => {
  const url = new URL(connectionString);
  url.pathname = "/mysql";
  return url.toString();
};

const buildTestConnectionString = (
  connectionString: string,
  databaseName: string
) => {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

export const createTestDatabase = async (
  connectionString: string
): Promise<TestDatabase> => {
  const databaseName = buildDatabaseName();
  const adminPool = createPool(buildAdminConnectionString(connectionString));

  await adminPool.query(`CREATE DATABASE \`${databaseName}\``);

  const testPool = createPool(
    buildTestConnectionString(connectionString, databaseName)
  );
  const runDrizzle = drizzle as unknown as (
    pool: unknown,
    config: unknown
  ) => ReturnType<typeof drizzle>;
  const migrationDatabase = runDrizzle(testPool, {
    schema: mysqlSchema,
    mode: "default",
  });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  await migrate(migrationDatabase as unknown as Parameters<typeof migrate>[0], {
    migrationsFolder,
  });

  const cleanup = async () => {
    await testPool.end();
    await adminPool.query(`DROP DATABASE \`${databaseName}\``);
    await adminPool.end();
  };

  return {
    database: mysql({
      connectionString: buildTestConnectionString(
        connectionString,
        databaseName
      ),
      client: testPool,
    }),
    cleanup,
  };
};
