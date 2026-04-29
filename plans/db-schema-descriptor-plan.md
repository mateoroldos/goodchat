# DB Schema Descriptor Plan

## Analysis

### How better-auth does it

```
DBFieldAttribute (atom)
  └─ BetterAuthPluginDBSchema (plugin declares: { [table]: { fields: { [field]: DBFieldAttribute } } })
       └─ getAuthTables(options)  ← single merge: core + plugin fields + additionalFields
            ├─ runtime: parseInputData / parseUserOutput
            └─ CLI codegen: generateDrizzleSchema(tables, dialect) → TS string
```

Key properties of `DBFieldAttribute`:
- `type`: `"string" | "number" | "boolean" | "date" | "json"`
- `required`, `unique`, `index`, `returned`, `input`
- `references`: `{ model, field, onDelete }`
- `defaultValue`, `onUpdate`, `fieldName`, `sortable`, `bigint`

`getAuthTables()` reduces all plugins into one map, then merges plugin fields **into** core tables (e.g. two-factor adds `twoFactorEnabled` into the `user` table).

The drizzle generator reads the merged map → emits `{dialect}Table("tableName", { ... })` per table.

---

### How goodchat does it today

```
packages/storage/schema/{sqlite,postgres,mysql}.ts
  ← actual drizzle Table objects (used by storage repos at runtime)
  ← also copy-pasted as string templates into:

packages/templates/scaffold/generated/db-schema-templates.ts
  ← hardcoded TS strings, one per dialect

packages/templates/scaffold/db-schema-artifacts.ts
  ← reads those strings, writes files to consumer project:
      src/db/core-schema.ts   ← core drizzle tables (from template)
      src/db/auth-schema.ts   ← better-auth tables (from template, conditional)
      src/db/plugins/schema.ts ← always empty: `export const pluginSchema = {};`
      src/db/schema.ts         ← composes the three above
      drizzle.config.ts

apps/goodchat-cli db schema sync
  ← loads consumer goodchat.ts via jiti (dialect + auth.enabled)
  ← calls renderDbSchemaArtifacts()
  ← writes above files

GoodchatPlugin / GoodchatPluginDefinition
  ← NO schema property — plugins cannot declare DB tables
```

**Problems:**
1. Core schema duplicated: drizzle objects in `packages/storage` + string copies in `packages/templates`.
2. `pluginSchema` is always empty — plugins can't contribute tables.
3. Hard to maintain: changing a core table requires updating both places.
4. Drizzle codegen is fragile string templates, not a proper field-by-field generator.

---

## Target Architecture

```
packages/contracts/src/db/types.ts           ← GoodchatFieldAttribute (atom)
packages/contracts/src/db/plugin-schema.ts   ← GoodchatPluginSchema (what plugins declare)

packages/core/src/db/core-schema.ts          ← core tables as GoodchatTableSchema
packages/core/src/db/get-tables.ts           ← getGoodchatTables(plugins[]) → merged schema
packages/core/src/db/drizzle-generator.ts    ← generateDrizzleSchema(schema, dialect) → string

packages/contracts/src/plugins/types.ts      ← add `schema?: GoodchatPluginSchema`

apps/goodchat-cli db schema sync             ← load config + plugins → merge → generate → write
apps/create-cli scaffold                     ← generate schema from core only (no plugins at scaffold time)
```

Data flow:
```
core-schema.ts ──┐
                  ├─→ getGoodchatTables(plugins) → merged GoodchatSchema
plugin.schema ───┘              │
                                 ↓
                    generateDrizzleSchema(schema, dialect) → TS string
                                 │
                                 ↓
                    consumer: src/db/schema.ts
```

---

## Implementation Plan

### Step 1 — Descriptor types in `packages/contracts/src/db/`

Create `packages/contracts/src/db/types.ts`:

```ts
export type GoodchatFieldType = "string" | "number" | "boolean" | "date" | "json"

export type GoodchatFieldAttribute = {
  type: GoodchatFieldType
  required?: boolean
  unique?: boolean
  index?: boolean
  returned?: boolean          // mirrors better-auth: exclude from output
  input?: boolean             // mirrors better-auth: disallow on write
  defaultValue?: string | number | boolean | (() => string | number | boolean | Date)
  onUpdate?: () => Date
  references?: {
    model: string
    field: string
    onDelete?: "cascade" | "no action" | "restrict" | "set null" | "set default"
  }
  fieldName?: string          // override column name in DB
}

export type GoodchatTableSchema = {
  modelName?: string          // override table name in DB (defaults to key)
  fields: Record<string, GoodchatFieldAttribute>
  order?: number              // generation order hint
}

export type GoodchatSchema = Record<string, GoodchatTableSchema>
```

Create `packages/contracts/src/db/plugin-schema.ts`:

```ts
import type { GoodchatTableSchema } from "./types"

export type GoodchatPluginSchema = Record<string, GoodchatTableSchema>
```

**Tests:** none (pure types)

---

### Step 2 — Core schema as descriptor in `packages/core/src/db/core-schema.ts`

Declare all 4 core tables (threads, messages, aiRuns, aiRunToolCalls) as `GoodchatSchema`.
This replaces the source of truth that currently lives in `packages/storage/schema/*.ts`.

```ts
import type { GoodchatSchema } from "@goodchat/contracts/db"

export const coreSchema = {
  threads: {
    fields: {
      id:             { type: "string" },
      botId:          { type: "string", required: true, fieldName: "bot_id" },
      // ... all fields from current sqlite.ts
    },
    order: 1,
  },
  messages: { ... },
  aiRuns: { ... },
  aiRunToolCalls: { ... },
} satisfies GoodchatSchema
```

**Tests:** none (data declaration)

---

### Step 3 — Update plugin contract in `packages/contracts/src/plugins/types.ts`

Add `schema` to `GoodchatPlugin`:

```ts
import type { GoodchatPluginSchema } from "../db/plugin-schema"

export interface GoodchatPlugin {
  name: string
  schema?: GoodchatPluginSchema   // ← new
  hooks?: GoodchatHooks
  mcp?: MCPServerConfig[]
  systemPrompt?: string
  tools?: Record<string, Tool>
}
```

No change to `GoodchatPluginDefinition` — `schema` stays a static property (not runtime-created).

**Tests:** none (type only)

---

### Step 4 — Merge function in `packages/core/src/db/get-tables.ts`

```ts
import type { GoodchatPlugin } from "@goodchat/contracts/plugins"
import type { GoodchatSchema } from "@goodchat/contracts/db"
import { coreSchema } from "./core-schema"

export const getGoodchatTables = (plugins: GoodchatPlugin[]): GoodchatSchema => {
  return plugins.reduce((acc, plugin) => {
    if (!plugin.schema) return acc
    for (const [table, def] of Object.entries(plugin.schema)) {
      acc[table] = {
        ...def,
        modelName: def.modelName ?? table,
        fields: { ...acc[table]?.fields, ...def.fields },
      }
    }
    return acc
  }, structuredClone(coreSchema) as GoodchatSchema)
}
```

**Tests** (`packages/core/src/db/get-tables.unit.test.ts`):
- Returns core schema when plugins is empty
- Plugin new table is included in output
- Plugin field extends existing core table
- Two plugins extending same table — fields merged, later plugin wins
- Plugin extending non-core table (pure new table)

---

### Step 5 — Drizzle generator in `packages/core/src/db/drizzle-generator.ts`

```ts
import type { GoodchatSchema } from "@goodchat/contracts/db"

export type DatabaseDialect = "sqlite" | "postgres" | "mysql"

export const generateDrizzleSchema = (
  schema: GoodchatSchema,
  dialect: DatabaseDialect
): string => { ... }
```

Logic (modelled on better-auth's `drizzle.ts` but sqlite-only first pass, expand to pg/mysql):
1. Build import list from field types present in schema
2. For each table in schema (sorted by `order`):
   - Emit `export const {camelTableName} = {dialect}Table("{modelName || key}", { id: text/varchar("id").primaryKey(), ...fields })`
   - Map `GoodchatFieldType` → dialect-specific drizzle column builder
   - Apply `.notNull()`, `.unique()`, `.references(...)` etc.
3. Emit composed `export const schema = { ...tables }`

Type mapping (sqlite):

| GoodchatFieldType | SQLite             | Postgres          | MySQL                |
|-------------------|--------------------|-------------------|----------------------|
| string            | `text`             | `text`            | `text` / `varchar`   |
| number            | `integer`          | `integer`         | `int`                |
| boolean           | `integer({mode:boolean})` | `boolean` | `boolean`           |
| date              | `text`             | `timestamp`       | `timestamp`          |
| json              | `text({mode:json})`| `jsonb`           | `json`               |

**Tests** (`packages/core/src/db/drizzle-generator.unit.test.ts`):
- Single table, all field types → output contains correct drizzle builders per dialect
- `required: false` field → no `.notNull()`
- `unique: true` field → `.unique()`
- `references` field → `.references(() => otherTable.id, { onDelete: "cascade" })`
- `defaultValue` string literal → `.default("value")`
- `fieldName` override → column name uses fieldName, TS key uses logical name
- Schema with two tables → both exported + schema object contains both
- Plugin table merged via `getGoodchatTables` → appears in generated output

---

### Step 6 — Update `apps/goodchat-cli` db schema sync

**File:** `apps/goodchat-cli/src/commands/db-schema-sync-command.ts`

Changes:
1. After loading config via jiti, also extract `plugins` from the goodchat instance (need to extend `LoadedGoodchatConfig` to include `plugins?: GoodchatPlugin[]`)
2. Call `getGoodchatTables(plugins ?? [])` to get merged schema
3. Call `generateDrizzleSchema(tables, dialect)` to produce the consumer schema string
4. Emit single `src/db/schema.ts` (no longer split into core/auth/plugin sub-files)

The `src/db/plugins/schema.ts` placeholder disappears — plugin tables are in `src/db/schema.ts` directly.

**Tests** (`db-schema-sync-command.unit.test.ts`):

Keep existing cases, update assertions for new output format, add:
- Config with plugin that declares a table → generated schema includes plugin table
- Config with plugin extending core table → generated schema has extended column
- Config with no plugins → generated schema matches core-only baseline
- `--check` mode with plugin → detects drift when plugin table missing from file

---

### Step 7 — Update `apps/create-cli` scaffold

**File:** `apps/create-cli/src/generator/` (likely `sqlite-migrate.ts` + new `schema.ts`)

At scaffold time there are no user plugins yet, so generate from `coreSchema` only:

```ts
import { coreSchema } from "@goodchat/core/db"
import { getGoodchatTables, generateDrizzleSchema } from "@goodchat/core/db"

export const renderSchemaFile = (dialect: DatabaseDialect): string =>
  generateDrizzleSchema(getGoodchatTables([]), dialect)
```

Remove dependency on `packages/templates/scaffold/generated/db-schema-templates.ts`.
`renderDbSchemaArtifacts` in `packages/templates` calls `renderSchemaFile` instead of the hardcoded template.

**Tests** (`apps/create-cli/src/generator/schema.unit.test.ts`):
- sqlite scaffold → output contains `threads`, `messages`, `aiRuns`, `aiRunToolCalls` tables
- postgres scaffold → uses `pgTable` import
- mysql scaffold → uses `mysqlTable` import

---

### Step 8 — Delete hardcoded templates

Once both CLIs use the generator:
- Delete `packages/templates/scaffold/generated/db-schema-templates.ts`
- Simplify `packages/templates/scaffold/db-schema-artifacts.ts` to use generator

The `packages/storage/schema/*.ts` drizzle files **remain** — they are the runtime source for the storage package repositories. They are not replaced in this plan (that's a separate concern: keeping storage schema in sync with core-schema.ts descriptors).

---

## File Diff Summary

```
packages/contracts/src/db/
  + types.ts               ← GoodchatFieldAttribute, GoodchatTableSchema, GoodchatSchema
  + plugin-schema.ts       ← GoodchatPluginSchema

packages/contracts/src/plugins/
  ~ types.ts               ← add schema?: GoodchatPluginSchema to GoodchatPlugin

packages/core/src/db/
  + core-schema.ts         ← core tables as GoodchatSchema
  + get-tables.ts          ← getGoodchatTables(plugins) → GoodchatSchema
  + get-tables.unit.test.ts
  + drizzle-generator.ts   ← generateDrizzleSchema(schema, dialect) → string
  + drizzle-generator.unit.test.ts

apps/goodchat-cli/src/commands/
  ~ db-schema-sync-command.ts          ← use generator instead of templates
  ~ db-schema-sync-command.unit.test.ts

apps/create-cli/src/generator/
  + schema.ts              ← renderSchemaFile(dialect)
  + schema.unit.test.ts

packages/templates/scaffold/
  ~ db-schema-artifacts.ts            ← call renderSchemaFile()
  - generated/db-schema-templates.ts  ← deleted
```

---

## Open Questions

1. **`packages/storage` source of truth**: After this plan, `packages/storage/schema/*.ts` and `packages/core/src/db/core-schema.ts` are two representations of the same tables. Should we generate storage's drizzle files from the descriptor? Deferred — needs a build-time codegen step.

2. **Auth schema**: Currently auth tables are generated from better-auth's own `getAuthTables()`. Should those also be folded into `getGoodchatTables()`? Current plan keeps them separate (auth is a conditional add-on, not a core table).

3. **Plugin schema at scaffold time**: `create-cli` scaffolds with no plugins. How does a user add plugin tables later? They run `goodchat db schema sync` which picks up plugins from their `goodchat.ts`. This is the clean flow — no change needed.

4. **`definePlugin` + `schema`**: Should `definePlugin()` accept a static `schema` at the definition level? Yes — schema is structural, not runtime, so it belongs in the factory definition, not the `create()` return value. Add `schema?: GoodchatPluginSchema` to `DefinePluginNoParamsOptions` / `DefinePluginWithParamsOptions`.
