# Auth Schema Provider Hardening Plan

## Goal

Keep a single generated `src/db/schema.ts` while making auth schema sourcing reliable, isolated, and CI-verified.

## Architecture

1. `getAuthSchema()` acts as the auth provider boundary.
2. `renderDbSchemaArtifacts()` composes `authSchema + coreSchema` into one schema file.
3. Import handling is derived from each generated block and merged, instead of hardcoded import sets.
4. CI enforces drift via `packages/templates` auth schema check.

## Execution Steps

1. Introduce provider contract in `get-auth-schema.ts` and keep generated assets as the default provider.
2. Update `db-schema-artifacts.ts` to parse both import blocks and emit one merged import line.
3. Add tests for:
   - auth-disabled import stability
   - auth-enabled table inclusion
   - plugin table inclusion in unified schema
4. Add CI step: `bun run --cwd packages/templates schema:auth:check`.

## Success Criteria

- Unified schema output works with auth on/off for all dialects.
- No duplicate/hardcoded import blocks in generated schema output.
- Auth schema drift is caught in CI.
