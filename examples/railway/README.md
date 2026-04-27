# Goodchat Deployment Guide

```text
 __  __                          
/\ \/\ \   __                    
\ \ `\\ \ /\_\     ___     ___   
 \ \ , ` \\/\ \   /'___\  / __`\ 
  \ \ \`\ \\ \ \ /\ \__/ /\ \L\ \
   \ \_\ \_\\ \_\\ \____\\ \____/
    \/_/\/_/ \/_/ \/____/ \/___/ 
                                 
                                 
```

## About This Bot

- Name: Nico
- Platforms: web, discord
- Runtime config: `src/goodchat.ts`

This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.
## Railway Deploy

1. Create a Railway service from this repo.
2. Keep generated `railway.json` as-is.
3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).
4. Deploy.

Quick CLI path: `bun run railway:link`, then `bun run railway:up`.

For SQLite, Railway runs `bun run start:railway` so migrations execute after the `/data` volume is mounted.
SQLite selected: mount a Railway volume at `/data` and set `DATABASE_URL=/data/goodchat.db`.

If deploy fails, check migration output first. The app usually just reports the bad news.
