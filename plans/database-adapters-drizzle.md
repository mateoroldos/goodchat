# Database Adapters (Drizzle-First) Plan

## Goal

Design and implement a Drizzle-first persistence layer for Goodchat that treats the database as a first-class product concern, not a pluggable adapter system. The system must be opinionated, ergonomic, and stable while keeping **migration ownership in the consumer application**.

## Principles

- **Drizzle is the source of truth** for schema definitions and types.
- **Consumers own migrations** and the timing of applying them.
- **Core does not expose ORM details** to feature code; it consumes a small persistence interface.
- **Multi-database support** comes from Drizzle dialects, not from custom adapters.
- **Simplicity over flexibility**: fewer extension points, stronger defaults.
- **Fail loud on schema drift** (runtime checks, no silent mismatch).

## Architecture Overview

### Core Concepts

- **Schema location**: `@goodchat/core` owns Drizzle tables and the schema version constant, exposed at `@goodchat/core/schema` via an explicit `schema.ts` entry file (no barrel files). Adapters must import this schema (no duplication).
- **Domain contracts**: Runtime types and the `Database` interface live in `@goodchat/contracts` and are consumed by core and adapters. Core does not define domain shapes.
- **Persistence layer**: A small interface in `@goodchat/contracts` that core uses for data access (threads, messages, and future models).
- **Dialect initializers**: Thin packages/functions that create a Drizzle DB instance for a given database (Postgres, SQLite) and implement the database interface.
- **Schema version table**: `goodchat_meta` stored in consumer DB to track applied schema version.

### Data Flow

1. User runs Drizzle migrations in their app (using Drizzle CLI).
2. User calls `createGoodchat({ database })`.
3. Adapter creates Drizzle DB + repositories.
4. Core services call repository methods only (no SQL, no ORM details).
5. Core verifies schema version (`goodchat_meta.schemaVersion`) and fails fast on mismatch.

### Architecture Diagram

```
                           ┌──────────────────────────┐
                           │        App / User        │
                           │ createGoodchat({ database })
                           │ runs Drizzle migrations  │
                           └─────────────┬────────────┘
                                         │
                                         ▼
                           ┌──────────────────────────┐
                           │        Core API          │
                           │ createGoodchat()         │
                           │ services/controllers     │
                           └─────────────┬────────────┘
                                         │ uses
                                         ▼
                           ┌──────────────────────────┐
                           │   Persistence Interface  │
                           │  Database + Repos + Tx   │
                           └─────────────┬────────────┘
                                         │ implemented by
                                         ▼
     ┌───────────────────────────┐      ┌───────────────────────────┐
     │ adapter-postgres          │      │ adapter-sqlite            │
     │ drizzle + postgres-js     │      │ drizzle + bun-sqlite       │
     └─────────────┬─────────────┘      └─────────────┬─────────────┘
                   │                                 │
                   ▼                                 ▼
            ┌───────────────┐                 ┌───────────────┐
            │  Postgres DB  │                 │  SQLite DB    │
            └───────────────┘                 └───────────────┘
```

## Public API Design

### User Configuration

```ts
import { postgres } from "@goodchat/adapter-postgres";

await createGoodchat({
  name: "Support Bot",
  prompt: "...",
  platforms: ["slack"],
  database: postgres({
    connectionString: process.env.DATABASE_URL,
    debugLogs: false,
  }),
});
```

### Goodchat Options

- Replace `messageStore` service with a single `database` option. You can fully remove the `messageStore` code. No backwards compatibility is required.
- `database` must satisfy the contracts database interface.
- Migration lifecycle is owned by the consumer application. Goodchat does not run migrations automatically.

## Database Interface

Domain-focused CRUD optimized for Goodchat needs, not generic query builders. The core uses **domain models** only; adapters map database records into normalized domain shapes. Include an explicit transaction boundary to prevent partial writes.

```ts
export interface Database {
  threads: {
    create: (input: ThreadCreate) => Promise<Thread>;
    getById: (id: string) => Promise<Thread | null>;
    list: (input: {
      botId: string;
      limit?: number;
      cursor?: {
        createdAt: string;
        id: string;
      };
      sort?: "asc" | "desc";
    }) => Promise<Thread[]>;
    update: (id: string, patch: ThreadUpdate) => Promise<Thread>;
    delete: (id: string) => Promise<void>;
  };
  messages: {
    create: (input: MessageCreate) => Promise<Message>;
    getById: (id: string) => Promise<Message | null>;
    listByThread: (input: {
      threadId: string;
      limit?: number;
      cursor?: {
        createdAt: string;
        id: string;
      };
      sort?: "asc" | "desc";
    }) => Promise<Message[]>;
    update: (id: string, patch: MessageUpdate) => Promise<Message>;
    delete: (id: string) => Promise<void>;
  };
  transaction: <T>(fn: (database: Database) => Promise<T>) => Promise<T>;
  ensureSchemaVersion: () => Promise<void>;
}
```

Core types are **domain models** (e.g. `Thread`, `Message`) and are not tied to database records. Adapters own `ThreadRecord`/`MessageRecord` types derived from the schema and map them into domain shapes before returning to core.

### Schema Version Enforcement

- `@goodchat/core/schema` exports `SCHEMA_VERSION` from the explicit `schema.ts` entry (no `index.ts`).
- A `goodchat_meta` table stores the latest applied schema version.
- `ensureSchemaVersion()` compares `goodchat_meta.schemaVersion` against `SCHEMA_VERSION` and throws with a migration hint if they differ.

Example failure:

```
GoodchatError: Database schema mismatch.
Expected: 2026-03-31
Found: 2026-02-10
Run: drizzle-kit push
```

## Schema Design

### Threads Model (Drizzle)

Canonical threads table must match runtime expectations with clear semantics. Columns that are mutable by external systems must be treated as snapshots if stored on thread rows.

- `id` (string, primary key)
- `botId` (string)
- `botName` (string)
- `platform` (string)
- `adapterName` (string)
- `threadId` (string)
- `userId` (string)
- `text` (string)
- `responseText` (string)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `lastActivityAt` (timestamp)

### Messages Model (Drizzle)

Canonical messages table:

- `id` (string, primary key)
- `threadId` (string)
- `role` (string, optional)
- `text` (string)
- `createdAt` (timestamp)
- `metadata` (json, optional)
- `userId` (string)
- `adapterName` (string)

### Dialect Strategy

Use a dialect-aware schema factory to avoid duplication while keeping correctness:

- `defineSchema(dialect)` returns tables with dialect-specific column types.
- If a column diverges across dialects (e.g. timestamp), map to a shared domain type.

## Migrations (Drizzle Kit)

- Schemas lives in `@goodchat/core/schema`.
- Migrations are generated and applied in **consumer applications**, not in Goodchat packages.
- Consumers point Drizzle Kit to the schema package and write migrations into their own repo.
- Goodchat runtime never runs migrations automatically.

### Consumer Migration Flow (Recommended)

```
drizzle-kit generate --schema node_modules/@goodchat/core/schema --out ./drizzle
drizzle-kit push --schema node_modules/@goodchat/core/schema
```

### Environment Variables (No Duplication)

Drizzle config should read from the same env vars used at runtime so users only set values once. The CLI must scaffold DB env entries using existing env metadata so `.env` and `src/env.ts` stay consistent. The scaffolded project uses `@t3-oss/env-core` with `dotenv/config`, so `drizzle.config.ts` should read from `process.env` (not a custom loader) to match the generated env layer.

Example `drizzle.config.ts` (consumer app):

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "node_modules/@goodchat/core/schema",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
});
```

## Multi-Database Support

### Postgres

- Support multiple Postgres drivers via a single adapter:
  - `postgres-js` (default)
  - `pg` (node-postgres)
  - `@neondatabase/serverless`
  - `@vercel/postgres`
- Export `postgres({ connectionString, driver, debugLogs, client })`.
- Allow passing a prebuilt client for Neon/Vercel to keep serverless ergonomics.

### SQLite (Bun)

- Use `drizzle-orm/bun-sqlite` with `Database` client.
- Export `sqlite({ path, debugLogs })`.

### MySQL

- Use `drizzle-orm/mysql2` with `mysql2` client.
- Export `mysql({ connectionString, debugLogs })`.

Each initializer should return the same `Database` interface and provide `ensureSchemaVersion()`.

## Implementation Plan

## Todo List

- [x] Add contracts database types under `packages/contracts/src/database/` and expose them via package exports.
- [x] Add contracts database interface in `packages/contracts/src/database/interface.ts` and export it.
- [x] Add Drizzle schema definition files and explicit schema entry at `packages/core/src/schema/schema.ts`.
- [x] Add schema contract tests and database interface type tests.
- [x] Scaffold adapter packages and drizzle folder structure for postgres/sqlite/mysql.
- [ ] Implement SQLite adapter client, repositories, and schema version check.
- [ ] Implement Postgres adapter client, repositories, and schema version check.
- [ ] Implement MySQL adapter client, repositories, and schema version check.
- [ ] Define and enforce `goodchat_meta` row strategy (single-row id, insert policy, error messages).
- [ ] Wire `createGoodchat` to require `database` and remove message store usage.
- [ ] Update runtime/controllers/services to use `database.threads` and `database.messages`.
- [ ] Add startup schema check `database.ensureSchemaVersion()`.
- [ ] Add migrations documentation and consumer `drizzle.config.ts` guidance.
- [ ] Update CLI scaffold to prompt for DB choice and emit `drizzle.config.ts`.
- [ ] Update docs/examples and run `check` + `check-types`.

### Phase 1: Database Interface and Schema

1. Add Drizzle tables and `SCHEMA_VERSION` under `packages/core/src/schema/`.
2. Expose schema for tooling at `@goodchat/core/schema` via `packages/core/src/schema/schema.ts` (no barrel files).
3. Add `packages/contracts/src/database/interface.ts` with the `Database` interface using domain models.
4. Add domain model types in `packages/contracts/src/database/` (e.g. `thread.ts`, `message.ts`).

### Phase 2: Persistence Usage in Core

1. Update `createGoodchat` to require `database`.
2. Update runtime and controllers to use `database.threads`/`database.messages`.
3. Add a startup check to call `database.ensureSchemaVersion()`.
4. Remove usage and implementation of `messageStore` service.

### Phase 3: Dialect Initializers

1. Create `@goodchat/adapter-postgres` with Drizzle `postgres-js` wiring.
2. Create `@goodchat/adapter-sqlite` with Drizzle `bun-sqlite` wiring.
3. Create `@goodchat/adapter-mysql` with Drizzle `mysql2` wiring.
4. Each package exposes a single `sqlite`, `postgres`, or `mysql` function.
5. Implement `ensureSchemaVersion()` using the `goodchat_meta` table.
6. Map database records into domain models before returning to core.

### Phase 4: Migrations and Tooling

1. Document consumer-owned migration flow using Drizzle Kit.
2. Provide a migration guide with example `drizzle.config.ts` pointing to `@goodchat/core/schema`.
3. Update the CLI scaffold to prompt for database choice and write the correct `drizzle.config.ts`.

### Phase 5: Cleanup

1. Update docs and examples to reflect `database`.
2. Run `check` and `check-types` for all packages changed.

## Testing Strategy

- Schema contract tests for `threads`, `messages`, and `goodchat_meta` (columns, nullability, primary keys).
- Schema version enforcement tests (`ensureSchemaVersion` success, mismatch, missing row, missing table).
- Repository tests with in-memory SQLite (create/get/update/delete, list ordering + cursor, metadata JSON).
- Transaction boundary tests (rollback on failure, defined nested behavior).
- Add a Postgres integration test with Docker or test DB.

## Success Criteria

- Core has no custom adapter code or registry.
- Persistence is Drizzle-first and ergonomic to configure.
- Postgres, SQLite, and MySQL are supported through Drizzle.
- Migrations are owned by consumer applications.
- Schema drift is detected at runtime.

## File Tree (Proposed)

```
packages/
  contracts/
    src/
      database/
        interface.ts
        thread.ts
        message.ts
  core/
    src/
      services/
        thread-service.ts
        message-service.ts
      create-goodchat.ts
      schema/
        threads-table.ts
        messages-table.ts
        meta-table.ts
        schema.ts
  adapter-postgres/
    src/
      index.ts
      drizzle/
        client.ts
        repository.ts
        version-check.ts
  adapter-sqlite/
    src/
      index.ts
      drizzle/
        client.ts
        repository.ts
        version-check.ts
  adapter-mysql/
    src/
      index.ts
      drizzle/
        client.ts
        repository.ts
        version-check.ts
```
