import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const sqlite = new Database(process.env.DATABASE_URL);
const database = drizzle(sqlite);

migrate(database, { migrationsFolder: "./drizzle" });
console.log("SQLite migrations applied successfully.");
sqlite.close();
