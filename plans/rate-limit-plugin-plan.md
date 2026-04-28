# Rate Limit Plugin Plan (v1)

## Description

Add a simple, DX-first rate limit plugin in `@goodchat/plugins` to protect shared multi-platform bots from spam, runaway cost, and thread floods.

Goals:

- Keep public API flat and easy.
- Stop requests before model/tool execution.
- Return user-facing rate limit responses (not generic 500s).
- Keep plugin persistence self-contained (plugin-owned schema + repository).

Non-goals (v1):

- Advanced rule engine.
- Per-plan dynamic quotas.
- Redis/distributed-specific tuning.
- Scoping token limits to v2 (token limits read from core `aiRuns` table — coupling is explicit and acceptable).

---

## Architecture

### Simple explanation

`rateLimit({...})` installs a `beforeMessage` hook. The hook evaluates configured limits and returns a typed outcome:

- allow (`continue`), or
- deny (`deny`) with structured user response data.

Hook outcome contract (v1):

```ts
type BeforeHookResult =
  | void
  | { action: "continue" }
  | {
      action: "deny";
      reason: "rate_limited" | "forbidden" | "validation_failed";
      userMessage: string;
      retryAfterMs?: number;
      metadata?: Record<string, string | number | boolean>;
    };
```

**Type backward compatibility:** `BeforeMessageHook` currently returns `Promise<void>`. Changing the return type to `Promise<BeforeHookResult>` is backward compatible — `void` is assignable to `BeforeHookResult`. All existing hooks continue to type-check without modification. The hook runner treats `void` and `{ action: "continue" }` identically.

Core pipeline handles deny as a first-class path. The key distinction from better-auth: deny is not an HTTP response — it is a typed outcome that each transport maps independently:

- web sync/stream → HTTP `429` + `Retry-After` header
- gateway/chat adapters → post deny message, no AI call

This is intentional. A thrown error can't carry `retryAfterMs`. A generic `Response` object can't be posted to Slack. The typed deny is the right abstraction.

### Deny flow diagram

```text
Incoming message
  -> before hooks (sequential)
    -> rateLimit hook
      -> allow: continue pipeline
      -> deny: short-circuit immediately
         -> web-chat-controller:    HTTP 429 + body + Retry-After header
         -> gateway-processor:      adapter.postMessage(deny.userMessage), stop
  -> AI generation (only if all hooks allowed)
```

### Limit evaluation order

Checks run in this order. First denial wins. Cooldown is a state check (not a trigger) — the trigger happens as a side effect when a window denial fires.

```text
1. exemptUserIds?        → allow immediately, skip all checks
2. active cooldown?      → deny with cooldown retryAfter
3. maxConcurrentPerThread? → deny if lease held by another in-flight request
4. window limits         → evaluate in this sub-order:
     messagesPerThread
     messagesPerUser
     messagesPerBot
     tokensPerHour
     tokensPerDay
     tokensPerMonth
   → on first window denial:
       record violation
       if violations >= cooldown threshold in cooldown window → set cooldown state
       return deny
5. allow
   → acquire lease if maxConcurrentPerThread configured
   → lease released in afterMessage hook (or TTL expiry)
```

**Monitor mode:** All checks run identically. Counters and violations still increment. On denial, log the event but return `allow` instead of `deny`. This ensures monitor mode gives accurate signal about what would be blocked.

### Config DSL grammar

Window strings follow this grammar (parsed once at boot, error thrown on invalid):

```
window-string  = count "/" unit
unit           = number? base-unit
base-unit      = "s" | "m" | "h" | "d"
examples       = "20/5m" | "60/h" | "10000/d" | "500/30s"

cooldown-string = window-string " -> " duration
duration        = number base-unit
examples        = "3/10m -> 15m" | "5/1h -> 2h"
```

Parsed at `rateLimit({...})` call time via a small `parseWindow(s)` and `parseCooldown(s)` function in the plugin package. Invalid strings throw at bot startup, not at first message.

Alternative: accept structured objects to skip the parser entirely. Kept as DSL for DX — open to switching if the parser adds complexity disproportionate to value.

### Token limits — aiRuns coupling

Token limits (`tokensPerHour`, `tokensPerDay`, `tokensPerMonth`) are checked in `beforeMessage` against **historical** usage. At hook time the current message has not yet generated tokens. The check sums tokens from past `aiRuns` records for the relevant window.

The plugin's `RateLimitRepository` interface exposes:

```ts
getTokenUsage(params: { botId: string; userId?: string; since: Date }): Promise<number>
```

The concrete implementation queries the core `aiRuns` table. This coupling is explicit and intentional — documented in the implementation, not hidden. The interface shields consumers from the query detail.

### Repository bootstrapping

The plan's repo-injection model requires consumers to wire up the repository. This must be simple or nobody does it. The plugin package ships a `createRateLimitRepository(db)` factory:

```ts
// Consumer app: src/db/plugins/schema.ts
import { rateLimitSchema } from "@goodchat/plugins/rate-limit";
export { rateLimitSchema };

// Consumer app: src/goodchat.ts
import { createRateLimitRepository } from "@goodchat/plugins/rate-limit";
import { db } from "./db";

const rateLimitRepo = createRateLimitRepository(db);

export default defineBot({
  plugins: [
    rateLimit({
      messagesPerThread: "20/5m",
      repository: rateLimitRepo,
    }),
  ],
});
```

Three consumer steps: import schema, call factory, pass to plugin. The factory handles all query logic internally.

### SQLite concurrency note

`maxConcurrentPerThread` uses a lease table with TTL. In Postgres/MySQL, leases use `SELECT FOR UPDATE`. In SQLite (WAL mode), there is no row-level locking — lease acquire/release uses `BEGIN IMMEDIATE` transactions, which serializes all writers (not just per-thread). This is acceptable for local dev and small deployments but will bottleneck under high write concurrency. Documented in the plugin README; not a bug, a known constraint.

### Observability — event shape

All rate limit events emit via the hook context logger with a consistent shape:

```ts
type RateLimitEvent = {
  event: "rate_limit.allow" | "rate_limit.deny" | "rate_limit.cooldown" | "rate_limit.lease_release";
  botId: string;
  userId: string;
  threadId: string;
  platform: Platform;
  rule: "messagesPerThread" | "messagesPerUser" | "messagesPerBot"
      | "tokensPerHour" | "tokensPerDay" | "tokensPerMonth"
      | "maxConcurrentPerThread" | "cooldown" | null;
  limit: number | null;
  current: number | null;
  retryAfterMs?: number;
  mode: "enforce" | "monitor";
};
```

`rule: null` on allow events. `limit/current: null` on cooldown events (not window-based).

### File tree (planned)

```text
packages/plugins/src/
  rate-limit/
    config.ts                          # DSL parser (parseWindow, parseCooldown) + zod config schema
    repository.ts                      # RateLimitRepository interface + createRateLimitRepository factory
    schema.ts                          # rate-limit plugin drizzle tables
    events.ts                          # RateLimitEvent type + emit helper
    hook.ts                            # beforeMessage + afterMessage hook logic
    index.ts                           # rateLimit() plugin factory (public API)

packages/contracts/src/
  hooks/types.ts                       # BeforeHookResult union type, BeforeMessageHook return updated

packages/core/src/
  chat-response/
    hook-runner.ts                     # collect deny result from hooks, return it
    errors.ts                          # HookDenyError (carries BeforeHookResult deny payload)
    index.ts                           # stop pipeline on deny, pass deny to transport layer
  server/
    web-chat-controller.ts             # map deny -> 429 + Retry-After + body
  runtime/
    gateway-message-processor.ts      # map deny -> adapter.postMessage + stop

examples/vercel/src/db/
  plugins/schema.ts                    # compose plugin schemas (rate-limit + future plugins)
  schema.ts                            # merge core + auth + plugin schemas

apps/goodchat-cli/src/commands/
  db-schema-sync-command.ts            # preserve plugins/schema.ts (do not overwrite)
```

### Public plugin API (v1)

```ts
rateLimit({
  // Window limits (DSL string or omit to skip)
  messagesPerThread: "20/5m",
  messagesPerUser: "60/h",
  messagesPerBot: "10000/d",

  // Token limits — reads from core aiRuns table
  tokensPerHour: 50_000,
  tokensPerDay: 200_000,
  tokensPerMonth: 2_000_000,

  // Concurrency
  maxConcurrentPerThread: 1,           // lease-based, TTL auto-expires

  // Cooldown: N violations in window -> block for duration
  cooldown: "3/10m -> 15m",

  // Behavior
  mode: "enforce",                     // "enforce" | "monitor"
  message: "Rate limit reached. Try again in {{retryAfter}}.",
  exemptUserIds: ["admin-1"],

  // Required: injected repository
  repository: rateLimitRepo,
})
```

---

## Plan

### 1. Hook outcome contract (`packages/contracts`)

- Add `BeforeHookResult` union type to `hooks/types.ts`.
- Change `BeforeMessageHook` return type: `Promise<void>` → `Promise<BeforeHookResult>`.
- Verify backward compat: `void` is assignable to `BeforeHookResult`, no existing hooks break.
- Add `denyRateLimit({ userMessage, retryAfterMs })` helper in `packages/plugins/src/rate-limit/index.ts` (not in contracts — plugin-layer DX only).

### 2. Core short-circuit path (`packages/core`)

- `hook-runner.ts`: after each before hook, check if result is `{ action: "deny" }`. If so, stop iterating and return the deny payload (do not throw — throw is for unexpected errors).
- `errors.ts`: add `HookDenyError` that wraps the deny payload, used internally to propagate deny through the call stack.
- `chat-response/index.ts`: on deny outcome, do not call AI. Return a typed `Result.deny(payload)` to the transport layer.
- `web-chat-controller.ts`: on deny → HTTP `429`, set `Retry-After` header if `retryAfterMs` present, write `userMessage` as response body.
- `gateway-message-processor.ts`: on deny → call adapter to post `userMessage` to thread, stop. No AI call.

### 3. Plugin package structure (`packages/plugins/src/rate-limit/`)

- `config.ts`: zod schema for `RateLimitConfig`. `parseWindow(s)` and `parseCooldown(s)` functions. Throw descriptive errors on bad input at parse time.
- `schema.ts`: drizzle tables — `rateLimitWindows` (counters per scope/key/window), `rateLimitLeases` (concurrency), `rateLimitCooldowns` (active cooldown state), `rateLimitViolations` (violation log for cooldown threshold).
- `repository.ts`: `RateLimitRepository` interface + `createRateLimitRepository(db)` factory. Factory implements the interface against plugin-owned tables + reads from core `aiRuns` for token queries.
- `events.ts`: `RateLimitEvent` type + `emitRateLimitEvent(log, event)` helper.
- `hook.ts`: `buildBeforeHook(config, repo)` and `buildAfterHook(config, repo)` — pure functions, no side effects on config.
- `index.ts`: `rateLimit(config)` — validates config, returns `GoodchatPlugin` with `beforeMessage` and `afterMessage` hooks wired.

### 4. Plugin hook logic (`hook.ts`)

Evaluation order (strict, first denial wins):

1. `exemptUserIds` check → allow
2. Active cooldown lookup → deny with `retryAfterMs = cooldownExpiresAt - now`
3. Lease check (if `maxConcurrentPerThread`) → deny
4. Window checks in order: `messagesPerThread`, `messagesPerUser`, `messagesPerBot`, `tokensPerHour`, `tokensPerDay`, `tokensPerMonth`
   - On first window denial: record violation, check if cooldown threshold met, set cooldown if so
5. Allow path: acquire lease if `maxConcurrentPerThread` configured, emit `rate_limit.allow`

`afterMessage` hook: release lease, emit `rate_limit.lease_release`.

Monitor mode: run all checks, emit events, but always return `allow`.

### 5. Schema composition + CLI fix

- Add `rateLimitSchema` export from `packages/plugins/src/rate-limit/schema.ts`.
- Consumer composes in `src/db/plugins/schema.ts` — this file is app-owned.
- `db-schema-sync-command.ts`: treat `src/db/plugins/schema.ts` as user-owned. If the file exists, do not overwrite. If it does not exist, create it with a comment indicating it is user-managed.
- Test: `db schema sync` run twice does not reset `plugins/schema.ts`.

### 6. Observability

- Emit `RateLimitEvent` via `context.log.set(event)` on every hook execution.
- Events: `rate_limit.allow`, `rate_limit.deny`, `rate_limit.cooldown`, `rate_limit.lease_release`.
- `mode` field always present so dashboards can filter monitor vs enforce traffic.

---

## Tests

### Unit

- `config.ts`: DSL parsing — valid values (`"20/5m"`, `"60/h"`, `"10000/d"`), cooldown syntax (`"3/10m -> 15m"`), invalid strings (throw at parse time), negative values (zod rejection).
- Hook result semantics: `void` treated as allow, `{ action: "continue" }` as allow, `{ action: "deny" }` stops pipeline.
- `denyRateLimit` helper builds correct payload shape.
- Retry-after formatting and `{{retryAfter}}` interpolation in message template.
- Exemption: exempt user bypasses all checks.
- Monitor mode: denial conditions met → emit event, return allow (not deny).
- Evaluation order: cooldown checked before window, window denial triggers cooldown record.
- Repository contract: atomic window consume, lease acquire idempotency, cooldown TTL expiry.

### Integration

- Web sync: denied request → `429` + `userMessage` body + `Retry-After` header when `retryAfterMs` set.
- Web stream: denied request → `429` before stream opens.
- Gateway: denied request → adapter posts `userMessage`, no AI call made.
- Concurrency: second in-flight request on same thread → denied. After first completes → lease released → next request allowed.
- Lease TTL: if `afterMessage` hook never fires (crash), lease auto-expires and next request is allowed.
- Window limits: `messagesPerThread` counter enforces correctly across window boundary (old events outside window not counted).
- Token limits: `tokensPerHour` reads sum of `aiRuns.inputTokens + outputTokens` for botId in the window.
- Cooldown: 3 window violations within 10m → cooldown state set → subsequent requests denied with cooldown `retryAfterMs` → expires after 15m.
- Schema composition: `plugins/schema.ts` includes rate-limit tables, core/auth tables unaffected.
- CLI sync: `db schema sync` preserves existing `plugins/schema.ts` content.

### End-to-end

- Bot with `rateLimit` plugin under message burst → friendly rate-limit response shown in web chat.
- Multi-platform (web + slack): `messagesPerUser` counter spans both platforms (userId-scoped).
- Normal traffic under all limits: no latency regression, all requests pass through.
- Monitor mode bot under burst: all requests succeed, deny events visible in logs.
