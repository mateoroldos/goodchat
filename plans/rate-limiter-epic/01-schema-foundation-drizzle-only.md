# Plan: schema foundation drizzle only

## Spec
- `specs/rate-limiter-epic.md`
- Change: `01-schema-foundation-drizzle-only`

## Data flow
```text
core schema DSL (canonical)
  -> core dialect emitters (sqlite/postgres/mysql drizzle ts)
  -> auth schema import (better-auth canonical, pinned version)
  -> auth normalization (deterministic)
  -> template artifact renderer
  -> goodchat db schema sync (write/check)
  -> consumer artifacts (drizzle.config.ts + src/db/*.ts)
```

## Changes
- [ ] **feat(schema): add canonical core schema dsl + auth external import contract**
  - Introduce dialect-neutral schema definition for core tables.
  - Treat Better Auth as canonical source for auth tables and import into deterministic normalized model.
  - No CLI behavior change yet.
  - Tests it owns:
    - [ ] `dsl model for core schema is deterministic`
    - [ ] `better-auth auth model normalization is deterministic`

- [ ] **feat(schema): add drizzle dialect emitters from core dsl + auth import pipeline**
  - Emit sqlite/postgres/mysql Drizzle schema text from core DSL.
  - Emit sqlite/postgres/mysql auth schema text from Better Auth import + deterministic normalization.
  - Keep output parity with current declarations.
  - Tests it owns:
    - [ ] `sqlite core drizzle schema is generated from dsl`
    - [ ] `postgres core drizzle schema is generated from dsl`
    - [ ] `mysql core drizzle schema is generated from dsl`
    - [ ] `sqlite auth drizzle schema is generated from better-auth import`
    - [ ] `postgres auth drizzle schema is generated from better-auth import`
    - [ ] `mysql auth drizzle schema is generated from better-auth import`

- [ ] **feat(templates): switch template assets to dsl emitters**
  - Update `packages/templates/scripts/build-db-schema-template-assets.ts` to consume core DSL emitters and auth import pipeline instead of reading `packages/storage/schema/**` files.
  - Preserve generated template contract and names.
  - Tests it owns:
    - [ ] `db schema template assets are produced from core dsl emitters and auth import pipeline`
    - [ ] `generated template maps include core and auth for all dialects`

- [ ] **feat(cli): keep db schema sync deterministic with dsl-backed templates**
  - Keep CLI interface and artifact paths unchanged.
  - Keep auth schema generation unconditional in consumer artifacts (auth tables are generated even when auth is disabled).
  - Verify byte-stable artifacts and `--check` behavior across dialects.
  - Keep plugin schema placeholder unchanged in this change.
  - Tests it owns:
    - [ ] `db schema sync output is byte-stable for same input`
    - [ ] `db schema sync check passes after sync for each dialect`
    - [ ] `db schema sync always generates auth schema artifact regardless of auth enabled config`

- [ ] **refactor(storage): make workspace schema derived, not canonical**
  - Transition `packages/storage/schema/**` and `packages/storage/schema/auth/**` to derived outputs/wrappers from DSL source.
  - For auth specifically, derived outputs/wrappers must come from Better Auth import + normalization, not hand-authored declarations.
  - Preserve existing export names and compatibility.
  - Tests it owns:
    - [ ] `storage schema exports remain compatible after dsl source switch`

## Risks
- Runtime/storage consumers may break if export names drift during source-of-truth move.
- Non-byte-identical emitter output will cause churn in generated artifacts and check mode failures.
- Object/render order must be explicit to guarantee determinism.
- Better Auth upstream codegen/output format changes can break auth normalization if the contract is implicit.
- If auth generation depends on runtime auth-enabled flags, environment-only toggles can create schema drift.

## Out of scope for this plan
- Plugin schema contracts (`02-contracts-foundation`)
- Plugin discovery + namespacing conflict handling (`03-schema-normalization-discovery`)
- Extended `--check` diagnostics categories + JSON (`04-drizzle-integration`)
- Runtime migration gating (`05`), hook DB gateway (`06`), rate limiter plugin (`07`)
- Replacing Better Auth canonical ownership for auth tables with full in-repo DSL ownership.
