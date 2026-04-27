# Architecture

Goodchat is a Turborepo + Bun monorepo. The system is centered on a single `createGoodchat(...)` runtime contract that composes model providers, platform adapters, plugins, MCP tools, storage, and dashboard APIs into one Elysia app.

## Monorepo Layout

Apps

- `apps/create-cli/` - Published `create-goodchat` scaffolder. Interactive project bootstrap with deployment profiles (Docker, Railway, Vercel), provider/platform/env collection, and generated app files.
- `apps/goodchat-cli/` - Published `goodchat` lifecycle CLI. Currently owns `goodchat db schema sync` (write/check mode) against generated schema artifacts.
- `apps/web/` - SvelteKit dashboard SPA (`ssr = false`, `prerender = false`) for auth status, bot metadata, platform status, analytics, threads, runs, and web chat.
- `apps/landing/` - Astro marketing site with Svelte integration and shared styles.

Packages

- `packages/contracts/` - Source of truth for zod models and inferred types: bot config, platforms, model/provider metadata, hooks, plugins, capabilities (tools + MCP), and DB interfaces.
- `packages/core/` - Runtime composition and server APIs: auth runtime, gateway boot, webhook routing, web chat endpoints, AI response pipeline, plugin merge/validation, telemetry, and dashboard static serving.
- `packages/plugins/` - Built-in plugin implementations (currently `linear`) built on the contracts plugin factory.
- `packages/storage/` - Drizzle-backed storage adapters and repositories for sqlite/postgres/mysql, plus schema exports for core + auth tables.
- `packages/state-sqlite/` - Chat SDK state adapter for SQLite (locks, subscriptions, cache, lists, queue).
- `packages/state-mysql/` - Chat SDK state adapter for MySQL with equivalent state semantics.
- `packages/templates/` - Reusable schema/template asset pipeline consumed by CLIs (including generated multi-dialect schema templates).
- `packages/styles/` - Shared Tailwind v4 design tokens, theme variables, and bundled fonts.
- `packages/typescript-config/` - Shared TypeScript base config.

## Runtime Topology

- User app exports a `goodchat` instance created by `createGoodchat(...)`.
- `packages/core` validates config, resolves plugins, validates provider/env constraints, and builds a single Elysia app.
- API groups are mounted under `/api`:
  - Public: `/api/health`, `/api/auth-status`, `/api/webhook/*`.
  - Auth endpoints: `/api/auth/*` (Better Auth forwarding).
  - Protected routes (when auth enabled): `/api/bot`, `/api/threads/*`.
  - Web chat routes: `/api/web/chat` and `/api/web/chat/stream` (public or protected based on `auth.webChatPublic`).
- Dashboard static assets are served from the packaged web build when `dashboard: true`.

## Chat Processing Pipeline

For webhook and web chat requests, the flow is:

1. Request reaches platform webhook or web chat controller.
2. Gateway initializes eagerly (non-serverless) or lazily on first webhook (serverless).
3. Platform/thread context is normalized into `MessageContext`.
4. `beforeMessage` hooks execute.
5. Toolset is built by merging static tools with MCP-discovered tools.
6. AI response runs in sync or streaming mode via AI SDK provider registry.
7. `afterMessage` hooks execute (non-blocking on failure).
8. Post-processing persists thread, messages, AI run telemetry, and tool calls.
9. Response is sent back to platform/web client.

## State and Persistence

- Domain persistence (`packages/storage`) supports sqlite, postgres, and mysql through a common `Database` interface.
- Persisted entities include threads, messages, AI runs, AI run tool calls, and weekly analytics aggregates.
- Chat gateway state adapter is selectable via config:
  - `database` (auto-resolves by dialect),
  - `memory`,
  - `redis`.
- Database-backed chat state reuses `@goodchat/state-sqlite`, `@goodchat/state-mysql`, or `@chat-adapter/state-pg` where compatible.

## Auth Model

- Auth is optional and implemented with Better Auth in `packages/core`.
- Mode is currently shared-password based.
- Bootstrap creates one internal shared account and then closes signup.
- Session guard protects dashboard/API routes when auth is enabled.

## Extensibility Model

- Plugins can add hooks, MCP servers, tools, and system-prompt fragments.
- Plugin env and params are zod-validated at runtime.
- MCP transports supported: `stdio`, `http`, and `sse`.
- Model provider catalog is contract-driven (OpenAI, Anthropic, Google, OpenRouter, AI Gateway, Vercel Gateway).

## Tooling and Workflow

- Turborepo orchestrates `build`, `dev`, `check-types`, and test pipelines across workspaces.
- Bun is the package manager/runtime for scripts and CLIs.
- Ultracite is used for lint/format checks.
- Elysia Eden provides end-to-end API typing for the dashboard client.
- `better-result` is the primary result/error flow primitive in runtime services.
- Zod schemas at package boundaries drive runtime validation and TypeScript inference.
