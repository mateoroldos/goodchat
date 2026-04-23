# Goodchat Deployment Guide

```text
 __     __                     _ 
 \ \   / /___  _ __  ___  ___ | |
  \ \ / // _ \| '__|/ __|/ _ \| |
   \ V /|  __/| |  | (__|  __/| |
    \_/  \___||_|   \___|\___||_|
                                 
```

## About This Bot

- Name: Vercel
- Platforms: web, discord
- Runtime config: `src/goodchat.ts`

This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.

Deploy on Vercel serverless. No pets, only functions.

## Vercel Deploy

1. Import the project in Vercel.
2. Keep generated `vercel.json` as-is.
3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).
4. Deploy.

Quick CLI path: `bun run vercel:link` then `bun run vercel:deploy:prod`.

Use external Postgres/MySQL. SQLite is not scaffolded for Vercel because temporary files are not a database strategy.

For other serverless hosts, use the same `src/index.ts` shape: export `app` and skip `app.listen`.