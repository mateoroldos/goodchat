# Auth & Access Control Plan (v0)

## Description

We are simplifying access control for v0 to ship fast without painting ourselves into a corner.

We will:

- Protect dashboard and internal APIs with session auth.
- Keep local chat optionally public via explicit toggle.
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

`@goodchat/core` exposes dashboard auth endpoints and guards. Login accepts only password, then signs in against Better Auth using internal shared email + password. Better Auth issues session cookie. Core guards protect dashboard routes. Local chat routes are public only if `auth.localChatPublic=true`.

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
  -> /api/local/chat*
      -> if auth.localChatPublic=true: allow anonymous
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
    local-chat-controller.ts                 # public/guarded toggle

apps/server/src/
  app.ts                                     # consumer example only (no auth logic)

apps/web/src/
  routes/login/+page.svelte                  # password-only form
  routes/+layout.ts                          # redirect/session bootstrap
  lib/components/app-nav.svelte              # login/logout UI actions
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

- `/api/local/chat`
- `/api/local/chat/stream`
  - public only when `auth.localChatPublic=true`
  - otherwise protected

#### Runtime invariants

- If `auth.enabled=true`, require:
  - `GOODCHAT_DASHBOARD_PASSWORD`
  - `GOODCHAT_AUTH_SECRET`
  - `GOODCHAT_AUTH_BASE_URL`
- Shared account bootstrap is idempotent.
- Signup is disabled in shared-password mode.
- Guard is fail-closed on session/auth errors.
- `auth.localChatPublic` defaults to `false`.
- Consumer apps must not implement duplicate auth logic.

#### Config/env contract (v0)

```ts
// src/goodchat.ts
auth: {
  enabled: true,
  mode: "password",
  localChatPublic: false,
  sharedEmail: "dashboard@goodchat.local",
  sharedPasswordEnv: "GOODCHAT_DASHBOARD_PASSWORD",
}
```

```env
GOODCHAT_DASHBOARD_PASSWORD=change-me
GOODCHAT_AUTH_SECRET=replace-me
GOODCHAT_AUTH_BASE_URL=http://localhost:3000
GOODCHAT_AUTH_TRUSTED_ORIGINS=http://localhost:3000
```

#### Schema & migrations boundary

- Core owns auth runtime behavior and route guards.
- Consumer owns migration execution timing.
- Better Auth tables and Goodchat tables are migrated via one consumer pipeline.

Migration ownership rule:

1. Consumer generates/updates schema artifacts.
2. Consumer runs `drizzle-kit generate/migrate`.
3. Core only validates DB compatibility at runtime.

#### Migration path (v1+)

- Keep guard contract (`requireSession`) stable.
- Add OAuth providers in Better Auth config.
- Replace password-only login UI with provider login.
- Keep protected route contracts unchanged.
- Add per-user identity/RBAC later without changing controller boundaries.

---

## Plan

1. **Update config contract in `@goodchat/contracts`**
   - Add `auth` shape to `packages/contracts/src/config/models.ts`.
   - Include `enabled`, `mode`, `localChatPublic`, `sharedEmail`, `sharedPasswordEnv`.

2. **Implement Better Auth integration in `@goodchat/core`**
   - Add Better Auth setup in shared-password mode.
   - Disable signup.
   - Set secure session/cookie defaults and trusted origins support.

3. **Implement shared account bootstrap in core**
   - Ensure internal shared account exists.
   - Reconcile password from env idempotently.

4. **Add core dashboard auth endpoints**
   - `POST /api/dashboard/login` (password-only payload).
   - `POST /api/dashboard/logout`.
   - `GET /api/dashboard/session`.

5. **Add centralized auth policy in core**
   - `requireSession` helper/middleware.
   - Deny-by-default for dashboard endpoints with explicit public allowlist.

6. **Apply local chat visibility policy in core**
   - Respect `auth.localChatPublic` for `/api/local/chat*`.
   - Enforce auth when toggle is off.

7. **Harden core controllers**
   - Never trust identity from request body.
   - Derive actor from authenticated session when route is protected.

8. **Update web app login UX**
   - Add password-only login page.
   - Redirect unauthenticated users to `/login`.
   - Add logout action.

9. **Keep consumer app as pure consumer example**
   - `apps/server` only passes config to `createGoodchat`.
   - No duplicated auth handlers/middleware in app layer.

10. **Document limitations + upgrade path**
    - Shared account means no per-user attribution in v0.
    - OAuth multi-user is planned next step with same guard boundary.

---

## Tests

## Unit

- Auth config schema parsing and invalid config failures.
- Shared account bootstrap idempotency.
- `requireSession` pass/fail behavior.
- Local chat toggle policy behavior.

## Integration

- Login success sets cookie.
- Wrong password returns `401` and sets no cookie.
- Protected routes deny unauthenticated requests.
- Protected routes allow authenticated requests.
- `/api/local/chat*` respects public/private toggle.
- Signup route blocked in shared-password mode.

## End-to-end

- Dashboard redirects to `/login` when unauthenticated.
- Password login unlocks threads/logs/bot views.
- Session persists on refresh.
- Logout re-locks protected routes.
- Production warning emitted when local chat is public.
