# Multi-Platform Deployment Plan

## Problem

Today deployment guidance is uneven across providers and mixes runtime concerns with platform config concerns (`README.md`).

This creates three problems:

- Users cannot quickly choose a provider path with clear requirements.
- Serverless and edge runtimes have different constraints, but we do not model that explicitly.
- `create-goodchat` scaffolds app code but does not scaffold provider deployment assets yet (`apps/create-cli/src/index.ts`, `apps/create-cli/src/generator.ts`).
- Database selection is asked without provider context, so users can pick invalid combinations (for example `vercel` + `sqlite`).

## Solution

Adopt a hybrid strategy:

- Generate provider-specific deployment templates from scaffolding.
- Keep a small runtime deployment adapter boundary in core/runtime code.
- Document deployments in `README.md` with a provider matrix and copy-paste setup per target.

Group providers by runtime family:

- Process/container: Docker, Railway.
- Serverless function: Vercel, Netlify functions.
- Edge isolate: Cloudflare Workers.

## Implementation Steps

1. Ask deployment provider first in `create-goodchat`
   - First prompt: deployment target (`docker`, `railway`, `vercel`, `netlify`, `cloudflare`).
   - Optional multi-select can be added later, but first release should optimize for one primary deployment target.
   - Keep default to `docker` for maximum compatibility.

2. Gate database choices based on deployment target
   - Compute allowed DB dialects from selected provider before asking DB questions.
   - Restrict serverless/edge targets (`vercel`, `netlify`, `cloudflare`) to `postgres` and `mysql`.
   - Allow `sqlite` only for process/container targets where local disk is stable (`docker`, `railway` with persistent volume).
   - If user switches provider after selecting DB, re-validate and re-prompt.

3. Add deployment template generation in scaffolding
   - Introduce template rendering in `apps/create-cli/src/generator.ts` for provider files.
   - Generate only the selected provider files to keep scaffolds minimal.

4. Add Docker baseline templates
   - Generate `Dockerfile` and `.dockerignore` in scaffolded projects.
   - Ensure build command compiles app and start command runs built output.
   - Document `PORT` and required env vars.

5. Add Railway templates
   - Generate `railway.json` (or `railway.toml`) with `preDeployCommand` for migrations.
   - Ensure runtime binds `process.env.PORT`.
   - Add notes for volume usage and managed DB in docs.

6. Add Vercel templates
   - Generate `vercel.json` with Bun runtime pin.
   - Keep serverless entrypoint mode (`export default app`, no always-on `listen`).
   - Add env + duration guidance in README.

7. Add Netlify templates
   - Generate `netlify.toml` and function entrypoint mapping.
   - Document when to use background/scheduled functions.
   - Clarify stateless runtime and external persistence requirements.

8. Add Cloudflare Workers templates (separate runtime path)
   - Generate `wrangler.toml` and Worker-compatible entrypoint.
   - Use an edge-compatible adapter path for Elysia/HTTP handling.
   - Explicitly avoid Bun-only APIs in this target path.

9. Define a minimal runtime adapter boundary
   - Add small interfaces for request handling, streaming writes, and background scheduling.
   - Keep business/bot logic provider-agnostic.
   - Keep provider-specific behavior in thin bindings.

10. Update README deployment docs
   - Add provider matrix: runtime type, config file, build/start, FS model, DB model, background jobs, streaming/websocket caveats.
   - Add quick-start snippets per provider.
   - Add a "choose your platform" section with recommended default path.

11. Add validation and CI checks
    - Add scaffold snapshot tests to verify generated provider files.
    - Add smoke checks for generated commands (`build`, `start`, and migration hooks).
    - Add docs check ensuring deployment section includes all supported targets.

## Platform Requirements

- Docker
  - `Dockerfile`, `.dockerignore`, env injection, exposed `PORT`, external DB.
  - `sqlite` allowed for single-node deployments with mounted volume.

- Railway
  - `railway.json`/`railway.toml`, predeploy migration command, `PORT` binding, managed DB/network config.
  - `sqlite` only when persistent volume is configured; otherwise recommend `postgres`.

- Vercel
  - `vercel.json`, function entrypoint export, serverless limits awareness, external DB/state.
  - Do not scaffold `sqlite` for Vercel target.

- Netlify
  - `netlify.toml`, functions directory/entrypoints, background/scheduled function separation, external state.
  - Do not scaffold `sqlite` for Netlify target.

- Cloudflare Workers
  - `wrangler.toml`, Worker module entrypoint, edge-safe APIs, KV/D1/R2/Durable Objects as needed.
  - Do not scaffold `sqlite` for Workers target.

## Is an Adapter Needed?

Yes, but small and explicit.

- Needed for runtime capability differences (process vs serverless vs edge).
- Not needed for pure deployment metadata (provider config files belong to scaffolding templates).
- Avoid over-abstracting bot logic; keep adapter boundary narrow.

## Chat SDK Serverless Notes

- Chat SDK patterns are compatible with serverless webhook handling and streamed responses.
- Production deployments still require:
  - Durable external state (not in-memory).
  - Fast webhook acknowledgement and async work offload.
  - Platform-specific streaming/update throttling and timeout handling.

## Operational Notes

- Treat Docker as the reference deployment baseline for parity and debugging.
- Treat Cloudflare Workers as a dedicated edge target with explicit limitations.
- Keep generated scaffolds minimal; generate only selected provider assets.

## Acceptance Criteria

- `create-goodchat` can scaffold provider deployment assets for selected targets.
- `create-goodchat` asks deployment provider before database dialect and prevents invalid provider/DB combinations.
- README has a clear deployment matrix and copy-paste instructions for each supported platform.
- Generated projects run in at least one process target and one serverless target without manual file creation.
- Cloudflare path is clearly marked as edge-specific and avoids Bun-only APIs.
- Runtime adapter boundary exists and is limited to deployment/runtime concerns.
