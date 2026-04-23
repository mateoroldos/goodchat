import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { customAlphabet } from "nanoid";
import { Pool } from "pg";
import { postgresSchema } from "../../schema/postgres";
import { postgres } from "../../src/postgres";

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
  url.pathname = "/postgres";
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
  const adminPool = new Pool({
    connectionString: buildAdminConnectionString(connectionString),
  });

  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  const testPool = new Pool({
    connectionString: buildTestConnectionString(connectionString, databaseName),
  });
  const migrationDatabase = drizzle(testPool, { schema: postgresSchema });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  await migrate(migrationDatabase as unknown as Parameters<typeof migrate>[0], {
    migrationsFolder,
  });

  const cleanup = async () => {
    await testPool.end();
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [databaseName]
    );
    await adminPool.query(`DROP DATABASE "${databaseName}"`);
    await adminPool.end();
  };

  return {
    database: postgres({
      connectionString: buildTestConnectionString(
        connectionString,
        databaseName
      ),
      client: testPool,
      driver: "pg",
    }),
    cleanup,
  };
};
