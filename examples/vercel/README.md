# Goodchat Deployment Guide

```text
 ____             __                  
/\  _`\          /\ \                 
\ \ \L\ \  __    \_\ \   _ __   ___   
 \ \ ,__//'__`\  /'_` \ /\`'__\/ __`\ 
  \ \ \//\  __/ /\ \L\ \\ \ \//\ \L\ \
   \ \_\\ \____\\ \___,_\\ \_\\ \____/
    \/_/ \/____/ \/__,_ / \/_/ \/___/ 
                                      
                                      
```

## About This Bot

- Name: Pedro
- Platforms: web, discord
- Runtime config: `src/goodchat.ts`

This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.
## Vercel Deploy

1. Import the project in Vercel.
2. Keep generated `vercel.json` as-is.
3. Set required env vars (`OPENAI_API_KEY`, `DATABASE_URL`, platform keys).
4. Deploy.

Quick CLI path: `bun run vercel:link` then `bun run vercel:deploy:prod`.

Use external Postgres/MySQL. SQLite is not scaffolded for Vercel because temporary files are not a database strategy.

For other serverless hosts, use the same `src/index.ts` shape: export `app` and skip `app.listen`.