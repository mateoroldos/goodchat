# Consumer-Side Schema Generation Plan

## Description

We will split responsibilities clearly across two CLI packages:

- **Scaffolding package** (`create-goodchat`): one-time project bootstrap.
- **Lifecycle package** (`goodchat`): repeatable commands during development/upgrades.

Why:

- Avoid schema drift from copied files.
- Support extensibility (Better Auth + plugins + app tables).
- Keep migration lifecycle owned by the consumer app.

Target outcome:

- Consumer composes schema sources and runs migrations.
- Goodchat core remains runtime logic + compatibility checks.
- `create-goodchat` scaffolds base app files only.
- `goodchat` provides dedicated schema-sync and future lifecycle commands.

---

## Architecture

### Simple explanation

Consumer app has one composed schema entrypoint used by Drizzle. That entrypoint merges:

1. Goodchat core schema (package import)
2. Auth generated schema (consumer-owned artifact)
3. Optional plugin/app schema fragments

Then consumer runs Drizzle migration commands.

### Diagram

```text
create-goodchat (or bun create goodchat) (scaffolding, one-time)
  -> creates app/runtime skeleton only

goodchat db schema sync (repeatable lifecycle command)
  -> generates/updates drizzle.config.ts
  -> generates/updates src/db/schema.ts composition file
  -> generates/updates src/db/auth-schema.ts
  -> generates/updates src/db/plugins/schema.ts
  -> validates generated schema artifacts

drizzle-kit generate + drizzle-kit migrate (consumer-owned)
  -> applies composed schema to consumer DB

Runtime: createGoodchat(...) -> ensureSchemaVersion() -> fail fast on mismatch
```

### File tree

```text
apps/create-cli/src/
  commands/
    init-command.ts                         # scaffolding
  scaffolding/
    project-scaffolder.ts                   # one-time bootstrap internals
    templates/
      drizzle-config.template.ts
      db-schema.template.ts

apps/goodchat-cli/src/
  commands/
    db-schema-sync-command.ts               # new repeatable schema sync command
    doctor-command.ts                       # future lifecycle diagnostics
    auth-command.ts                         # future auth lifecycle commands

packages/core/src/schema/
  sqlite.ts
  postgres.ts
  mysql.ts
```

### More details

#### Ownership boundaries

- `@goodchat/core`: canonical Goodchat table definitions + runtime compatibility checks.
- Better Auth: auth table generation capability.
- Consumer app: schema composition + migration generation/apply timing.
- `create-goodchat`: automates project scaffolding only (no schema artifacts).
- `goodchat`: automates schema/auth/plugin lifecycle operations, but does not own migrations.

#### Composition rule

- Never copy core schema sources into consumer app.
- Always compose from imports + generated artifacts.

#### Command model

Scaffolding command:

- `bun create goodchat` or `npx create-goodchat@latest`
  - creates project structure
  - does not generate schema files

Schema sync command:

- `goodchat db schema sync`
  - generates/updates `drizzle.config.ts`
  - generates/updates composed `src/db/schema.ts`
  - generates/updates `src/db/auth-schema.ts`
  - generates/updates `src/db/plugins/schema.ts`
  - validates generated file integrity
  - optional `--check` mode for CI (no writes)

Migration commands (consumer-controlled):

- `drizzle-kit generate`
- `drizzle-kit migrate`

Transition compatibility (temporary):

- Keep a short-lived alias path for legacy scaffolder entrypoints.
- If a lifecycle command is invoked from `create-goodchat`, print a deprecation warning that points to `goodchat <command>`.

#### Example composition shape

```ts
import { sqliteSchema as goodchatSchema } from "@goodchat/core/schema/sqlite";
import { authSchema } from "./auth-schema";
import { pluginSchema } from "./plugins/schema";

export const schema = {
  ...goodchatSchema,
  ...authSchema,
  ...pluginSchema,
};
```

---

## Plan

1. **Split CLI responsibilities into two packages**
   - Keep `create-goodchat` as scaffold-only bootstrap entrypoint.
   - Introduce `goodchat` as the long-lived lifecycle CLI.
   - Add temporary aliases/deprecation messaging for a smooth transition.

2. **Rename internal CLI language from “generator” to “scaffolder”**
   - Update scaffolding code structure and naming to reflect one-time bootstrap intent.

3. **Refactor scaffolding outputs**
   - Remove copied core schema files from scaffold output.
   - Stop generating all schema artifacts from scaffolding.

4. **Add dedicated schema sync command in lifecycle CLI**
   - Implement `goodchat db schema sync`.
   - Generate/refresh `drizzle.config.ts`, composed schema, auth schema, and plugin schema artifacts.
   - Validate generated artifact integrity.
   - Add `--check` mode for CI drift detection.

5. **Wire package scripts in scaffolded project**
   - Add script aliases for schema sync and migration commands.
   - Scripts should call `goodchat ...` for lifecycle operations.
   - Keep migration apply timing in consumer control.

6. **Define plugin schema extension convention**
   - Standardize plugin schema fragment location under `src/db/plugins/`.
   - Compose plugin schema fragments in `src/db/schema.ts`.

7. **Align runtime and migration env usage**
   - Ensure one consistent DB env contract for runtime and drizzle config.
   - Eliminate path/env mismatch patterns.

8. **Update docs**
   - Explain package split: bootstrap with `create-goodchat`, operate with `goodchat`.
   - Explain lifecycle split: scaffold once, sync often, migrate explicitly.
   - Add troubleshooting for schema mismatch and drift.

9. **Keep runtime fail-fast guarantees**
   - Preserve `ensureSchemaVersion()` check behavior.
   - Improve mismatch error messages to reference consumer migration workflow.

---

## Tests

## Unit

- Scaffolder tests verify no copied core schema file is emitted.
- Scaffolder tests verify no schema artifacts are emitted.
- Lifecycle CLI tests verify `db schema sync` is implemented in `goodchat` package, not `create-goodchat`.
- `db schema sync` command tests for:
  - write mode updates artifacts
  - `--check` mode reports drift without writes

## Integration

- Scaffolded project runs `goodchat db schema sync` successfully.
- Scaffolded project runs `drizzle-kit generate/migrate` successfully.
- Runtime boots after migrations and passes `ensureSchemaVersion()`.

## End-to-end

- `bun create goodchat` -> `goodchat db schema sync` -> `drizzle-kit generate` -> `drizzle-kit migrate` -> app boots.
- Add simulated plugin schema fragment and verify migration includes plugin tables.
- Upgrade core schema version and verify app fails fast until consumer runs sync + migrations.
