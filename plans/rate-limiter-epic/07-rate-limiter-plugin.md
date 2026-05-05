# Plan: rate limiter plugin

## Spec
`specs/rate-limiter-epic.md` — stack `07-rate-limiter-plugin`

## Solution overview

Add the first real persistence-backed Goodchat plugin: `rateLimiter` in `@goodchat/plugins/rate-limiter`.

The first iteration should be intentionally simple: fixed-window message limits evaluated in a plugin `beforeMessage` hook and persisted through the plugin-declared schema plus hook DB capability. The public API should stay ergonomic and stable enough to evolve later into richer policy controls such as token limits, conditional rules, cost budgets, sliding windows, and soft-limit actions.

Primary DX goal:

```ts
import { rateLimiter } from "@goodchat/plugins/rate-limiter";

export default defineBot({
  plugins: [
    rateLimiter({
      limits: [
        { by: "user", max: 20, window: "1h" },
        { by: "global", max: 1_000, window: "1h" },
      ],
    }),
  ],
});
```

Developers describe policy, not storage, counters, or hook wiring.

## Data flow

```txt
incoming platform message
  → adapter-normalized MessageContext
  → plugin beforeMessage hook
  → normalize configured limits
  → derive subject key for each rule
  → read/increment fixed-window counter through hook DB capability
  → if allowed: continue normal bot pipeline
  → if exceeded: short-circuit/block with configured/default response
```

## V1 consumer API

### Minimal configuration

```ts
rateLimiter({
  limits: [{ by: "user", max: 100, window: "1d" }],
});
```

### Explicit configuration

```ts
rateLimiter({
  limits: [
    {
      key: "user-daily",
      by: "user",
      max: 100,
      window: "1d",
      message: "Daily message limit reached. Try again in {retryAfter}.",
    },
  ],
});
```

### V1 rule shape

```ts
type RateLimitSubject = "user" | "thread" | "channel" | "platform" | "global";

type RateLimitRule = {
  key?: string;
  by: RateLimitSubject;
  max: number;
  window: string;
  message?: string;
};

type RateLimiterOptions = {
  limits: RateLimitRule[];
};
```

Recommended V1 defaults:

- `key`: generated from `by`, `max`, and normalized `window` when omitted.
- `message`: `You've hit the rate limit. Please try again in {retryAfter}.`
- `algorithm`: fixed-window only.
- `unit`: incoming messages only.
- `action`: block only.

Supported duration strings for V1:

```txt
10s, 1m, 15m, 1h, 1d, 30d
```

The parser can support the generic pattern `positive integer + s|m|h|d`, while validation should reject zero, negative, fractional, or unknown units.

## V1 functionality

- Persist counters across process restarts.
- Support multiple limits and block when any configured limit is exceeded.
- Support these dimensions:
  - `user`: one counter per platform user.
  - `thread`: one counter per thread/conversation.
  - `channel`: one counter per channel/room if available from context; otherwise revisit once context exposes it.
  - `platform`: one counter per platform.
  - `global`: one counter for the whole bot/plugin instance.
- Return a friendly retry-after message when blocking.
- Keep plugin storage limited to the declared plugin table through the hook DB gateway.

## Proposed V1 schema

Declare one plugin table, `counters`, and rely on schema sync to namespace it physically for the plugin and optional plugin instance key.

Logical columns:

- `id` — id primary key.
- `limit_key` — stable rule key.
- `subject_type` — `user`, `thread`, `channel`, `platform`, or `global`.
- `subject_key` — resolved subject identifier.
- `window_start` — fixed-window start timestamp.
- `window_end` — fixed-window end timestamp.
- `count` — current message count for this rule/subject/window.
- `created_at` — insert timestamp.
- `updated_at` — last increment timestamp.

Useful future schema addition, if the schema contract supports it later: unique index on `(limit_key, subject_type, subject_key, window_start)`.

## Changes

[ ] Add `@goodchat/plugins/rate-limiter` entry point

- Create `packages/plugins/src/rate-limiter.ts`.
- Add the export to `packages/plugins/package.json` and `packages/plugins/tsdown.config.ts`.
- Define the plugin with `definePlugin({ name: "rate-limiter", paramsSchema, schema, create })`.

[ ] Add V1 parameter validation and normalization

- Validate non-empty `limits`.
- Validate positive integer `max`.
- Validate duration strings and normalize to milliseconds.
- Validate supported `by` values.
- Generate default rule keys.
- Reject duplicate effective rule keys.

[ ] Add fixed-window counter domain

- Compute fixed windows from `Date.now()` and rule `windowMs`.
- Resolve subject keys from `MessageContext`.
- Format retry-after values for user-facing messages.
- Keep the pure policy pieces independently testable.

[ ] Wire the plugin hook to persistent counters

- In `beforeMessage`, evaluate every configured rule.
- Insert or increment the current window counter through `HookDbCapability`.
- Block/short-circuit when a rule is exceeded once the hook contract supports blocking semantics.
- Preserve hook DB capability boundaries: only access the plugin `counters` table plus allowed core capability if needed.

[ ] Add docs/example usage

- Document a basic public-bot protection setup.
- Include examples for per-user burst, per-user daily, and global bot limits.

## Tests

[ ] Parameter validation

- Accepts minimal valid config.
- Rejects empty limits.
- Rejects invalid duration strings.
- Rejects zero/negative/non-integer `max`.
- Rejects duplicate effective keys.

[ ] Pure rate-limit logic

- Parses durations correctly.
- Generates stable default keys.
- Computes fixed-window start/end boundaries.
- Formats retry-after values.
- Resolves subject keys for user/thread/platform/global.

[ ] Plugin behavior with DB capability

- Creates a counter on first message.
- Increments an existing counter under the limit.
- Blocks once `count >= max`.
- Allows again in the next fixed window.
- Evaluates multiple rules and blocks on the first exceeded rule.
- Persists decisions across plugin recreation/restart using the same database state.

[ ] Integration/package behavior

- `@goodchat/plugins/rate-limiter` export builds.
- Plugin schema is discoverable by schema sync.
- Hook DB access remains scoped to the rate-limiter table.

## V2 evolution ideas

### Custom subjects

Allow developers to limit by workspace, organization, tenant, account, customer, or any app-specific identity.

```ts
rateLimiter({
  limits: [
    {
      key: "workspace-monthly",
      by: {
        type: "workspace",
        resolve: ({ message }) => message.workspaceId,
      },
      max: 10_000,
      window: "30d",
    },
  ],
});
```

### Conditional rules

```ts
rateLimiter({
  limits: [
    {
      key: "slack-user-daily",
      by: "user",
      max: 100,
      window: "1d",
      when: ({ message }) => message.platform === "slack",
    },
  ],
});
```

### Token, cost, and AI usage budgets

Support units beyond incoming messages:

```ts
rateLimiter({
  limits: [
    { key: "user-tokens-day", by: "user", unit: "totalTokens", max: 50_000, window: "1d" },
    { key: "global-cost-month", by: "global", unit: "costUsd", max: 100, window: "30d" },
  ],
});
```

Potential units:

- `messages`
- `aiCalls`
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `costUsd`
- `toolCalls`

This likely requires after-message/AI telemetry integration instead of only `beforeMessage`.

### More algorithms

```ts
algorithm: "fixed-window" | "sliding-window" | "token-bucket"
```

Start fixed-window in V1; add sliding-window or token-bucket once usage patterns justify the complexity.

### Soft-limit actions

```ts
action: "block" | "warn" | "degrade" | "tag" | "webhook"
```

Examples:

- `warn`: allow the message but notify the user.
- `degrade`: switch to cheaper model, fewer context chunks, or no tools.
- `tag`: annotate logs/telemetry for later review.
- `webhook`: notify an external abuse or billing system.

### Preset DX

Once core behavior is proven, add ergonomic presets:

```ts
rateLimiter.protectPublicBot({
  burst: { max: 5, window: "10s" },
  perUser: { max: 100, window: "1d" },
  global: { max: 10_000, window: "1d" },
});
```

or helpers:

```ts
rateLimiter({
  limits: [
    rateLimiter.perUser({ max: 100, window: "1d" }),
    rateLimiter.global({ max: 10_000, window: "1d" }),
  ],
});
```

## Risks / open questions

- Current `PluginBeforeMessageHook` returns `Promise<void>`, so there may be no public short-circuit/blocking contract yet. The rate limiter either needs a hook contract enhancement or an existing error/response mechanism must be identified before implementation.
- `MessageContext` currently exposes `userId`, `threadId`, `platform`, bot fields, and text. It does not appear to expose `channelId`, workspace/team ID, tenant ID, or platform-specific organization IDs. V1 may need to omit `channel` or define fallback behavior until context expands.
- Hook DB capability currently exposes generic query/update/insert operations but no explicit transaction/upsert API. Counter increments may be race-prone under concurrent messages unless the gateway supports atomic update/upsert semantics or the first iteration accepts best-effort local correctness.
- The schema declaration contract shown here does not include indexes or unique constraints beyond column-level uniqueness. Efficient counter lookup and safe upsert would benefit from composite unique indexes later.
- Fail-open vs fail-closed behavior on DB errors should be explicit. Recommended V1 default: fail-open with structured logs to avoid taking the bot offline because rate-limit storage is unavailable; allow a future `failureMode: "open" | "closed"` option.
- Public bots may need per-workspace/customer limits more than per-platform limits. That should be a V2 priority once the message context can reliably expose tenant/workspace identifiers.
