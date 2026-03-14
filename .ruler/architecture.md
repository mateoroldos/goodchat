# Architecture

Goodchat is a monorepo managed with Turborepo and bun workspaces. The repo is split into apps for runtime concerns and packages for shared, versioned code. The system centers around a single bot config that can be compiled into multi-platform, streaming chatbots with tooling, context, and plugin extensions.

## Monorepo Layout

Apps

- `apps/web/` - SvelteKit dashboard for configuring bots, connecting platforms, and viewing threads.
- `apps/server/` - Elysia control plane API, webhook ingress, and runtime orchestration.
- `apps/cli/` - `goodchat` CLI that scaffolds, launches dev, builds, and runs production.

Packages

- `packages/core/` - Core primitives and services: `defineBot`, config loading, gateway, response generation, response handling.
- `packages/adapters/` - Platform adapters (Slack, Discord, Teams, Google Chat) and a common message model.
- `packages/context/` - RAG pipeline: loaders, chunking, embeddings, indexing, retrieval.
- `packages/plugins/` - Plugin SDK and built-in plugins (GitHub, Linear, Stripe, etc.).
- `packages/storage/` - SQLite persistence, migrations, and repositories.
- `packages/auth/` - Auth/session/token models and helpers for dashboard + API.
- `packages/env/` - Shared environment schemas and validation.
- `packages/config/` - Shared TypeScript config and tooling defaults.

## Runtime Topology

- The CLI is the launcher. `goodchat dev` starts the local control plane (Elysia server + dashboard) and loads `goodchat.config.ts`.
- The web app talks to the server API for bot config, OAuth connections, and thread streams.
- The server exposes a catch-all webhook endpoint (`/api/webhook/:botId/:platform`) and streams responses back to platforms.
- Shared packages are consumed by both apps to keep runtime, config, and env rules consistent.

## Server Runtime Layout

- `apps/server/src/runtime/` - Orchestration layer: bot registry, chat runtime wiring, and runtime-specific errors.
- `apps/server/src/modules/` - Controllers only (HTTP routing and adapter dispatch).
- `packages/core/src/config/config-watcher.ts` - Optional config watcher helper used by the server.

## Core Pipeline

Each incoming message follows a consistent pipeline:

1. Adapter parses the platform webhook into an internal message format.
2. Middleware `before` hooks run (logging, rate limiting, filtering).
3. Context retrieval runs (RAG over files, URLs, folders, or custom loaders).
4. Tool calls execute as needed, then the LLM generates a response.
5. Response streams back through the adapter.
6. Middleware `after` hooks run, and threads are persisted.

## Data & Storage (SQLite)

SQLite is the source of truth for:

- Bot configs and versions (syncs with `goodchat.config.ts`).
- Platform connections and OAuth tokens.
- Conversation threads and message history.
- Context index metadata (document versions, embeddings, chunk maps).
- API tokens and user sessions for the dashboard.

## Extensibility Model

- Plugins contribute tools, context sources, event handlers, and prompt fragments.
- Adapters define platform-specific parsing and streaming behavior.
- Middleware provides pre/post hooks around each message cycle.
- Custom loaders enable new context sources without changing core.

## Tooling and Workflow

- Turborepo orchestrates builds, linting, and caching across workspaces.
- Workspace commands are run from the repo root with `bun run <script>`.
- Lefthook runs git hooks and enforces checks before commit.
- For end-to-end typesafety we use Elysia Eden.
- For error handling we use better-result <https://github.com/dmmulroy/better-result>
- Use zod to validate data in the edges of our packages and applications.
- Derive interfaces from zod objects.
