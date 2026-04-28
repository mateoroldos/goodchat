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

Core pipeline handles deny as a first-class path:

- web sync/stream handshake -> HTTP `429`
- gateway/chat adapters -> post deny message and stop

### Diagram

```text
Incoming message
  -> before hooks
    -> rateLimit hook
      -> allow: continue
      -> deny: short-circuit
         -> web: 429 + message (+ Retry-After)
         -> gateway: post deny message
  -> AI generation (only if allowed)
```

### File tree (planned)

```text
packages/plugins/src/
  rate-limit.ts                      # public flat API + hook logic

packages/plugins/rate-limit/
  src/
    schema.ts                        # rate-limit plugin tables
    repository.ts                    # rate-limit repository + interface
    index.ts                         # plugin factory (inject repo)

packages/contracts/src/
  hooks/types.ts                     # before hook result supports deny

packages/core/src/
  chat-response/
    hook-runner.ts                   # collect hook deny result
    errors.ts                        # typed deny/control-flow error or result mapping
    index.ts                         # stop pipeline on deny
  server/web-chat-controller.ts      # map deny -> 429 response
  runtime/gateway-message-processor.ts # map deny -> user message

examples/vercel/src/db/
  plugins/schema.ts                  # compose plugin schemas
  schema.ts                          # merge core/auth/plugin schema

apps/goodchat-cli/src/commands/
  db-schema-sync-command.ts          # do not overwrite plugins/schema.ts
```

### Public plugin API (v1)

```ts
rateLimit({
  messagesPerThread: "20/5m",
  messagesPerUser: "60/h",
  messagesPerBot: "10000/d",
  tokensPerHour: 50_000,
  tokensPerDay: 200_000,
  tokensPerMonth: 2_000_000,
  maxConcurrentPerThread: 1,
  cooldown: "3/10m -> 15m",
  mode: "enforce", // or monitor
  message: "Rate limit reached. Try again in {{retryAfter}}.",
  exemptUserIds: ["admin-1"],
})
```

---

## Plan

1. **Hook outcome contract**
   - Extend `beforeMessage` return type with typed outcomes (`continue`/`deny`).
   - Keep backward compatibility for existing hooks (`void` + throw).
   - Add tiny helper for DX in plugins: `denyRateLimit({ userMessage, retryAfterMs })`.

2. **Core short-circuit path**
   - Handle `deny` outcome in chat-response pipeline before AI call.
   - Add consistent mapping for web sync, web stream, and gateway handlers.

3. **Plugin persistence contract (self-contained)**
   - Do not add `database.rateLimits` to core contracts.
   - Define plugin-owned repository interface in rate-limit package.
   - Plugin takes repository via params/DI (`rateLimit({ ..., repository })`).
   - Repository must support atomic consume/check, lease acquire/release (TTL), cooldown state.

4. **Schema composition + CLI behavior**
   - Add rate-limit tables to `src/db/plugins/schema.ts` in consumer apps.
   - Ensure `db schema sync` does not reset plugin schema file to `{}`.
   - Keep plugin schema ownership at app layer (core/auth/plugin merge).

5. **Plugin implementation**
   - Parse/validate flat config.
   - Evaluate limits in deterministic order (exempt -> cooldown -> concurrency -> windows).
   - Use injected repository for reads/writes.
   - Return deny with user-safe message and retry-after.

6. **Observability**
   - Emit structured log events: `rate_limit.allow`, `rate_limit.deny`, `rate_limit.cooldown`, `rate_limit.lease_release`.

---

## Tests

## Unit

- Config parsing: valid/invalid values (`"20/5m"`, cooldown syntax, negative values).
- Hook result semantics: `void`, `continue`, and `deny`.
- Helper behavior: `denyRateLimit` builds correct deny payload.
- Retry-after formatting and message interpolation.
- Exemption behavior (`exemptUserIds`).
- Mode behavior (`monitor` logs deny but allows).
- Repository contract tests (atomic consume semantics, lease TTL behavior).

## Integration

- Web sync: denied request returns `429` + message (+ `Retry-After` when present).
- Web stream: denied request returns `429` before stream starts.
- Gateway: denied request posts deny message, no AI call.
- Concurrency limit: second in-flight request denied; lease auto-expires/released.
- Window limits: thread/user/bot counters enforce correctly across time windows.
- Cooldown: N violations in window triggers temporary block.
- Consumer schema composition includes plugin tables without touching core/auth schemas.
- `db schema sync` preserves `src/db/plugins/schema.ts` custom plugin entries.

## End-to-end

- Bot with `rateLimit` plugin under message burst in web chat shows friendly rate-limit responses.
- Multi-platform scenario (web + slack/discord) enforces expected scope boundaries.
- Normal traffic under limits remains unaffected (no latency/regression).
