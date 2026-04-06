import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { postgresSchema, SCHEMA_VERSION } from "@goodchat/core/schema/postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createPostgresDatabase } from "../src/client";
import { META_ROW_ID } from "../src/version-check";

export interface TestDatabaseOptions {
  includeMetaRow?: boolean;
  includeMetaTable?: boolean;
  schemaVersion?: string;
}

export interface TestDatabase {
  cleanup: () => Promise<void>;
  database: Database;
}

const buildDatabaseName = () =>
  `goodchat_test_${randomUUID().replace(/-/g, "")}`;

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
  connectionString: string,
  options: TestDatabaseOptions = {}
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

  const includeMetaTable = options.includeMetaTable ?? true;
  if (!includeMetaTable) {
    await testPool.query('DROP TABLE "goodchat_meta";');
  } else if (options.includeMetaRow ?? true) {
    const schemaVersion = options.schemaVersion ?? SCHEMA_VERSION;
    await testPool.query(
      'INSERT INTO "goodchat_meta" (id, schema_version) VALUES ($1, $2);',
      [META_ROW_ID, schemaVersion]
    );
  }

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
    database: createPostgresDatabase({
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
