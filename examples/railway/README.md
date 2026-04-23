# Goodchat Deployment Guide

```text
  ____            _             
 |  _ \  ___   __| | _ __  ___  
 | |_) |/ _ \ / _` || '__|/ _ \ 
 |  __/|  __/| (_| || |  | (_) |
 |_|    \___| \__,_||_|   \___/ 
                                
```

## About This Bot

- Name: Pedro
- Platforms: web
- Runtime config: `src/goodchat.ts`

This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.

Deploy on Railway. Let predeploy migrations do the arguing.

## Railway Deploy

1. Create a Railway service from this repo.
2. Keep generated `railway.json` as-is.
3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).
4. Deploy.

Quick CLI path: `bun run railway:link`, then `bun run railway:up`.

Railway runs `bun run db:migrate` before `bun run start`.
SQLite selected: mount a Railway volume at `/data` and set `DATABASE_URL=/data/goodchat.db`.

If deploy fails, check migration output first. The app usually just reports the bad news.