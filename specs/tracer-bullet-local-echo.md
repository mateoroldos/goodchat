# Tracer Bullet: Local Echo Bot

**Overview**
Build a minimal end-to-end "local echo bot" flow that validates the Goodchat architecture by loading a bot config, handling a local webhook message, producing a response through core, persisting a log entry, and rendering logs in the web dashboard.

**Scope**
- In: local adapter, in-memory log store, single bot config load, basic log list UI, minimal CLI or server entry to run the flow.
- Out: OAuth, real Slack/Discord adapters, streaming, plugins, RAG/context indexing, persistence to SQLite.

**API Contracts**
- `POST /webhook/local`
  - Request JSON:
    - `botName: string`
    - `text: string`
    - `userId: string`
    - `threadId: string`
  - Response JSON:
    - `text: string`
    - `logId: string`
  - Errors:
    - `400` if any required field is missing or empty.
    - `404` if `botName` is unknown.
- `GET /logs`
  - Query: `limit?: number` (default 50, max 200)
  - Response JSON: `LogEntry[]`
  - `LogEntry` shape:
    - `id: string`
    - `timestamp: string` (ISO 8601)
    - `botName: string`
    - `platform: "local"`
    - `userId: string`
    - `threadId: string`
    - `text: string`
    - `responseText: string`

**Error Handling & Validation**
- Use `better-result` for control flow: return `Result` from adapter/config operations instead of throwing.
- Validate all external input with zod at package edges; derive TypeScript types from schemas.
- For `POST /webhook/local`, validate payload with zod (non-empty strings) and map validation errors to `400`.
- For config lookup failures (unknown bot), return a typed `Err` and map to `404`.

**Acceptance Criteria**
- [ ] Given `goodchat.config.ts` defines one bot with `name` and `prompt`, when the server starts, then the bot is loaded and available for requests.
- [ ] Given the server is running, when `POST /webhook/local` is called with valid fields, then it returns `200` with `text` equal to the input text prefixed by `Echo: ` and a new `logId`.
- [ ] Given the server is running, when `POST /webhook/local` is called with missing or empty required fields, then it returns `400` with a clear error message.
- [ ] Given a `botName` that is not defined in `goodchat.config.ts`, when `POST /webhook/local` is called, then it returns `404`.
- [ ] Given at least one message was processed, when `GET /logs` is called without a `limit`, then it returns the latest 50 log entries in reverse chronological order.
- [ ] Given the web dashboard loads, when the logs API returns entries, then the UI renders each entry showing bot name, user id, text, and response text.
- [ ] Given the web dashboard loads and there are no logs, then it renders an empty state message.

**Tasks**
1. [ ] Create a minimal config loader in `packages/core/src/config.ts` that reads `goodchat.config.ts`, returns a `Result<BotConfig, ConfigError>`, and avoids throwing.
2. [ ] Define core types in `packages/core/src/types.ts`: `BotConfig`, `IncomingMessage`, `BotResponse`, `LogEntry`.
3. [ ] Implement `defineBot` and `handleMessage` in `packages/core/src/bot.ts`:
   - `defineBot(config: BotConfig): BotConfig`
   - `handleMessage(message: IncomingMessage, bot: BotConfig): BotResponse` returning `Echo: ${message.text}`.
4. [ ] Add a simple in-memory log store in `packages/core/src/log-store.ts` with `appendLog(entry)` and `listLogs(limit)`.
5. [ ] Implement a local adapter in `packages/adapters/src/local-adapter.ts` that validates the webhook payload with zod and returns `Result<IncomingMessage, ValidationError>`.
6. [ ] Extend `apps/server/src/index.ts` to:
    - Load bot config at startup.
    - Add `POST /webhook/local` that uses the local adapter, handles `Result` errors via `better-result`, calls `handleMessage`, writes to log store, and returns the response.
    - Add `GET /logs` that returns `listLogs(limit)`.
7. [ ] Update `apps/web/src/routes/+page.svelte` to fetch `/logs` on load and render the list with an empty state.
8. [ ] Add a minimal `goodchat.config.ts` in repo root with one bot named `local-echo` and `platforms: ["local"]`.

**Open Questions**
- None. Defaults: in-memory logs, limit default 50 (max 200), local adapter only.
