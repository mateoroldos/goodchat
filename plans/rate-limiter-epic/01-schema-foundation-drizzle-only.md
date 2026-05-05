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
- [ ] **docs(spec): revise stack-01 boundaries to consumer-side generation and contracts**
  - Keep command name `goodchat db schema sync`.
  - Accept breaking removal of `@goodchat/storage/schema/*` exports.
  - Pin Better Auth normalized auth model in-repo for deterministic offline generation.

- [ ] **feat(contracts): add schema declaration contracts for core/auth/plugin schema definitions**
  - Add table/column/relation declaration contracts in `packages/contracts/src/schema/**`.
  - Add plugin schema declaration contracts for future plugin stack work.
  - Tests it owns:
    - [ ] `schema declaration contracts compile and export relation model`

- [ ] **feat(templates): move canonical schema dsl to runtime module with relations**
  - Canonical DSL and emitters are runtime-consumable (not script-only).
  - Emit relation blocks for core and auth schema outputs.
  - Tests it owns:
    - [ ] `core relations are emitted for sqlite`
    - [ ] `core relations are emitted for postgres`
    - [ ] `core relations are emitted for mysql`

- [ ] **feat(cli): generate consumer db schema artifacts from runtime emitters**
  - Remove dependency on committed generated template string map.
  - Continue deterministic byte-stable output and check mode behavior.
  - Tests it owns:
    - [ ] `db schema sync renders from runtime emitters without generated template asset file`

- [ ] **refactor(templates): remove committed template-asset pipeline**
  - Remove `scaffold/generated/db-schema-templates.ts` and asset build script coupling.
  - Keep scaffold API contract and artifact paths unchanged.
  - Tests it owns:
    - [ ] `render db schema artifacts does not import generated template constants`

- [ ] **refactor(storage): remove deprecated storage schema exports and old schema location**
  - Remove `packages/storage/schema/**` and package exports for these paths.
  - Migrate internal consumers/tests to non-exported internal schema modules.
  - Tests it owns:
    - [ ] `storage package has no public schema export paths`

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

- [ ] **feat(storage): switch schema artifact rendering to dsl emitters**
  - Use `packages/storage/src/scaffold/*` to consume core DSL emitters and auth import pipeline instead of reading `packages/storage/schema/**` files.
  - Preserve generated artifact contract and names.
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
