# Auth & Access Control Plan (v0)

## Description

Develop a basic auth system for project owners to access deployed dashboard. Created with Better Auth, v0 will just have password login managed from env variable.
Extensible to add new auth methods in future.

We will:

- Protect dashboard and internal APIs with session auth.
- Keep web chat optionally public via explicit toggle.
- Use Better Auth as internal session engine.
- Keep all auth logic inside `@goodchat/core` (consumer apps only configure and consume).

Key decision:

- UX is password-only.
- Implementation is Better Auth email/password with one fixed internal shared email.
  - User enters password only.
  - Core maps it to shared internal email on sign-in.

Non-goals (v0):

- No RBAC (owner/admin/member).
- No per-user auditing.
- No organizations/workspaces.
- No invitation/self-signup flows.

---

## Architecture

### Simple explanation

`@goodchat/core` exposes dashboard auth endpoints and guards. Login accepts only password, then signs in against Better Auth using internal shared email + password. Better Auth issues session cookie. Core guards protect dashboard routes. Web chat routes are public only if `auth.webChatPublic=true`.

### Diagram

```text
Browser
  -> POST /api/dashboard/login { password }
      -> core auth controller
      -> signInEmail(sharedEmail, password)
      -> Better Auth session cookie (HttpOnly)

Browser
  -> /api/threads | /api/bot | /api/logs
      -> core requireSession
      -> auth.api.getSession({ headers })
      -> allow or 401

Browser
  -> /api/web/chat*
      -> if auth.webChatPublic=true: allow anonymous
      -> else: requireSession
```

### File tree

```text
packages/contracts/src/config/
  models.ts                                 # add auth shape (only contract update)

packages/core/src/
  index.ts                                   # createGoodchat auth wiring
  auth/
    better-auth.ts                           # Better Auth instance + options
    bootstrap-shared-account.ts              # idempotent shared account bootstrap
    session-guard.ts                         # requireSession + route policy
  server/
    dashboard-auth-controller.ts             # /api/dashboard/login|logout|session
    bot-controller.ts                        # guarded
    threads-controller.ts                    # guarded
    web-chat-controller.ts                 # public/guarded toggle

apps/web/src/
  routes/login/+page.svelte                  # password-only form
  routes/+layout.ts                          # redirect/session bootstrap
  lib/components/app-nav.svelte              # login/logout UI actions

apps/goodchat-cli/
  src/commands/db-schema-sync-command.ts     # include auth schema generation - reading from goodchat config
```

### More details

#### Route protection matrix

Public:

- `/api/health`
- `/api/webhook/*`
- `/api/dashboard/login`
- `/api/dashboard/session` (returns `401` when not logged in)

Protected:

- `/api/threads*`
- `/api/bot*`
- `/api/logs*`
- other dashboard management endpoints

Conditional:

- `/api/web/chat`
- `/api/web/chat/stream`
  - public only when `auth.webChatPublic=true`
  - otherwise protected

#### Runtime invariants

- If `auth.enabled=true`, require:
  - `GOODCHAT_DASHBOARD_PASSWORD`
  - `GOODCHAT_AUTH_SECRET`
  - `GOODCHAT_AUTH_BASE_URL`
- Shared account bootstrap is idempotent.
- Signup is disabled in shared-password mode.
- Guard is fail-closed on session/auth errors.
- `auth.webChatPublic` defaults to `false`.
- Consumer apps must not implement duplicate auth logic.

#### Config/env contract (v0)

```ts
// src/goodchat.ts
auth: {
  enabled: true,
  mode: "password",                                         # only mode for the time
  webChatPublic: false,
  password: env.GOODCHAT_DASHBOARD_PASSWORD,
}
```

```env
GOODCHAT_DASHBOARD_PASSWORD=change-me
GOODCHAT_AUTH_SECRET=replace-me
```

#### Schema & migrations boundary

- Core owns auth runtime behavior and route guards.
- Schemas are generated using goodchat-cli
- Consumer owns migration execution timing.
- Better Auth tables and Goodchat tables are migrated via one consumer pipeline.

Migration ownership rule:

1. Consumer generates/updates schema artifacts using goodchat cli.
2. Consumer runs `drizzle-kit generate/migrate`.
3. Core only validates DB compatibility at runtime.

#### Migration path (v1+)

- Keep guard contract (`requireSession`) stable.
- Add OAuth providers in Better Auth config.
- Replace password-only login UI with provider login.
- Keep protected route contracts unchanged.
- Add per-user identity/RBAC later without changing controller boundaries.

---

## Tests

## Unit

- Auth config schema parsing and invalid config failures.
- Shared account bootstrap idempotency.
- `requireSession` pass/fail behavior.
- Local chat toggle policy behavior.
- Schema generation with different auth configs in goodchat cli.

## Integration

- Login success sets cookie.
- Wrong password returns `401` and sets no cookie.
- Protected routes deny unauthenticated requests.
- Protected routes allow authenticated requests.
- `/api/web/chat*` respects public/private toggle.
- Signup route blocked in shared-password mode.

## End-to-end

- Dashboard redirects to `/login` when unauthenticated.
- Password login unlocks threads/logs/bot views.
- Session persists on refresh.
- Logout re-locks protected routes.
- Production warning emitted when web chat is public.
