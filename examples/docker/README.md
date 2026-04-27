# Goodchat Deployment Guide

```text
 _____                                
/\___ \                               
\/__/\ \   __  __     __       ___    
   _\ \ \ /\ \/\ \  /'__`\   /' _ `\  
  /\ \_\ \\ \ \_\ \/\ \L\.\_ /\ \/\ \ 
  \ \____/ \ \____/\ \__/.\_\\ \_\ \_\
   \/___/   \/___/  \/__/\/_/ \/_/\/_/
                                      
                                      
```

## About This Bot

- Name: Juan
- Platforms: web, discord
- Runtime config: `src/goodchat.ts`

This bot is your source of truth. Edit it, commit it, deploy it, and blame it with confidence.
## Docker Deploy (SQLite)

```bash
bun run docker:migrate
bun run docker:up
```

SQLite is mounted at `/data/goodchat.db` inside the container. If you delete the volume, your memory resets too.

## Local Dev

```bash
bun run db:generate
bun run db:migrate
bun run dev
```

Host dev uses `./goodchat.db`. Docker SQLite mode uses `/data/goodchat.db` in the container volume.
Use `bun run docker:dev` for attached Docker logs, `bun run docker:up` for background startup, or `bun run docker:ready` in CI when you need migration + health checks before continuing.