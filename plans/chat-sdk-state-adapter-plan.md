# Chat SDK State Adapter Plan

## Problem

Today `@goodchat/core` uses Redis state when `REDIS_URL` exists, otherwise in-memory state (`packages/core/src/gateway/index.ts`).

This creates two problems:

- Redis introduces extra infrastructure we want to avoid.
- Memory state is not durable (lost on restart) and not correct for multi-process coordination.

We already support `postgres`, `mysql`, and `sqlite` as the app database, but Chat SDK state is not tied to that database yet.

## Solution

Use SQL-backed Chat SDK state adapters selected from the existing `database.dialect`:

- `postgres`: use official `@chat-adapter/state-pg`.
- `mysql`: implement `@goodchat` MySQL state adapter.
- `sqlite`: implement `@goodchat` SQLite state adapter (single-node target).

All adapters should use runtime schema bootstrap (create tables/indexes on connect), matching the official Postgres adapter approach.

## Implementation Steps

1. Add state adapter packages inside workspace
   - `packages/state-mysql/`
   - `packages/state-sqlite/`
   - Export `createMysqlState()` and `createSqliteState()`.

2. Implement full Chat SDK `StateAdapter` contract in both packages
   - `connect`, `disconnect`
   - `subscribe`, `unsubscribe`, `isSubscribed`
   - `acquireLock`, `releaseLock`, `extendLock`, `forceReleaseLock`
   - `get`, `set`, `setIfNotExists`, `delete`
   - `appendToList`, `getList`
   - `enqueue`, `dequeue`, `queueDepth`

3. Add runtime schema bootstrap in `connect()`
   - Create state tables and indexes with idempotent SQL.
   - Include TTL columns (`expires_at`) and indexes for cleanup/lookup.
   - Keep names aligned across adapters for consistency.

4. Wire database-aware state selection in core runtime
   - Pass `bot.database` into gateway creation path.
   - Replace Redis/env-based selection with dialect-based selection.
   - Keep memory state as explicit fallback only for unsupported/misconfigured cases.

5. Keep Redis support optional (non-default)
   - Do not remove package immediately.
   - Add optional goodchat.ts configuration for opting into redis adapter.

6. Add focused unit/integration tests
   - Lock ownership + TTL extension correctness.
   - Atomic dedupe via `setIfNotExists`.
   - Queue ordering + expiration behavior.
   - List trim/expiry behavior.
   - Connect idempotency and concurrent connect safety.

7. Add docs
   - Explain dialect-based state selection.
   - Mark SQLite state as single-node oriented.
   - Document runtime-created state tables.

## Operational Notes

- SQLite is accepted as single-node deployment state.
- Postgres/MySQL are preferred for distributed deployments.
- Runtime table creation is expected behavior for this feature.

## Acceptance Criteria

- Chat runtime uses DB-backed state for all supported dialects.
- No Redis required in the default path.
- State survives process restarts.
- Lock, dedupe, queue, and subscription behavior pass tests for each adapter.
- Docs clearly describe behavior and limitations.
