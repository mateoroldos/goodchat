# Handoff

## Summary of changes
- Added core/adapters packages for config loading, local adapter validation, in-memory log store, and echo handling.
- Server now loads `goodchat.config.ts`, handles `POST /webhook/local`, and serves `GET /logs` with limits.
- Web dashboard fetches `/logs` and renders entries with an empty/error state.

## Files touched
- apps/server/package.json
- apps/server/src/index.ts
- apps/web/src/routes/+page.svelte
- bun.lock
- goodchat.config.ts
- packages/adapters/package.json
- packages/adapters/src/local-adapter.ts
- packages/core/package.json
- packages/core/src/bot.ts
- packages/core/src/config.ts
- packages/core/src/log-store.ts
- packages/core/src/types.ts

## Tests and lint
- bun x ultracite check -> pass

## Known issues / risks / follow-ups
- Server exits on startup if config fails to load; if you prefer soft-fail behavior, adjust `apps/server/src/index.ts`.

## Assumptions
- `GET /logs` should return 400 when `limit` is negative or greater than 200; `limit=0` is allowed.
