<p align="center">
  <img src="packages/styles/assets/logo-light.svg#gh-light-mode-only" alt="Goodchat logo" width="420">
  <img src="packages/styles/assets/logo-dark.svg#gh-dark-mode-only" alt="Goodchat logo" width="420">
</p>
<p align="center">An <strong><i>almost good</i></strong> framework for building multi-platform AI chatbots.</p>
<p align="center">Works with</p>
<p align="center">
  <a href="https://slack.com"><img alt="Slack" src="https://api.iconify.design/logos:slack-icon.svg" width="20"></a>&nbsp;&nbsp;
  <a href="https://discord.com"><img alt="Discord" src="https://api.iconify.design/logos:discord-icon.svg" width="20"></a>&nbsp;&nbsp;
  <a href="https://www.microsoft.com/microsoft-teams"><img alt="Microsoft Teams" src="https://api.iconify.design/logos:microsoft-teams.svg" width="20"></a>&nbsp;&nbsp;
  <a href="https://github.com"><img alt="GitHub" src="https://api.iconify.design/logos:github-icon.svg" width="20"></a>&nbsp;&nbsp;
  <a href="https://linear.app"><img alt="Linear" src="https://api.iconify.design/simple-icons:linear.svg?color=%235E6AD2" width="20"></a>&nbsp;&nbsp;
  <a href="https://en.wikipedia.org/wiki/Web_application"><img alt="Web" src="https://api.iconify.design/simple-icons:googlechrome.svg?color=%230EA5E9" width="20"></a>
</p>
<p align="center">Self-hostable. Deploy on Docker, Railway, or Vercel.</p>
<p align="center">
  <a href="https://www.docker.com"><img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white"></a>
  <a href="https://railway.app"><img alt="Railway" src="https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white"></a>
  <a href="https://vercel.com"><img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white"></a>
</p>

## About

- Build AI chatbots in minutes and ship them to web and chat platforms from one codebase.
- Deploy anywhere useful: Docker, Railway, or Vercel.
- Use whichever LLM you trust this week.
- Configure everything from a single file.

```ts
import { createGoodchat, openai } from "@goodchat/core";

export const goodchat = createGoodchat({
  name: "Support Bot",
  prompt: "You are a helpful support assistant.",
  platforms: ["web", "slack", "discord"],
  model: openai("gpt-4.1-mini"),
  plugins: [linear({ team: "ENG" })],
});
```

## When to Use Goodchat

Use it when your team or community needs one shared, controlled, multi-platform bot with shared context, tools, plugins, and boring operational control - not a personal assistant for one person.

Practical examples:
- Internal support bot answering policy, product, and onboarding questions in Slack + Teams.
- Community Discord bot that handles FAQs, docs lookup, and moderation workflows.
- GitHub/Linear project bot that triages issues, posts updates, and assists contributors.

Don’t use it for:

- Coding copilots: [OpenCode](https://opencode.ai), [Claude](https://claude.ai), [Phi](https://www.phind.com).
- Powerful personal assistants: [OpenClaw](https://openclaw.ai) and Claude personal-agent setups.
- Heavy custom orchestration/agent architecture: [LangChain](https://www.langchain.com) or [Vercel AI SDK](https://ai-sdk.dev).
- Low-level chat plumbing and full event-level control: [Chat SDK](https://chat-sdk.dev).

If you genuinely want to build a fully custom multi-platform bot from scratch, that is a valid choice (and honestly pretty fun if you have the time). Chat SDK (https://chat-sdk.dev) is excellent.

Goodchat builds on top of it with quality-of-life abstractions so teams can ship faster, with less glue code and fewer integration headaches.

## Start

```bash
npm create @goodchat
```

### What You Get

- One `src/goodchat.ts` to configure your chatbot.
- A bun server with platform webhooks + web chat API wiring handled for you.
- Dashboard for bot status, platform setup, and thread visibility.
- Storage adapter for sqlite/postgres/mysql.

### Configuration

Your bot lives in `src/goodchat.ts`. One file. No maze.

```ts
import { createGoodchat, openai } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";
import { sqlite } from "@goodchat/storage/sqlite";
import { schema } from "./db/schema";
import { env } from "./env";

export const goodchat = createGoodchat({
  name: "Juan",
  prompt: "You are a startup CEO. You pivot weekly, monetize everything, and call panic 'vision'.",
  platforms: ["web", "slack", "discord"],
  model: openai("gpt-4.1-mini"),
  plugins: [linear({ team: "ENG" })],
  mcp: [
    {
      name: "github",
      transport: {
        type: "http",
        url: "https://api.githubcopilot.com/mcp/",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        },
      },
    },
  ],
  hooks: {
    beforeMessage: async (context) => {
      context.log.set({ source: "readme-example" });
    },
  },
  database: sqlite({ path: env.DATABASE_URL, schema }),
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
});
```
That's it.

## Support Matrix

What we support right now (in actual code, not vibes):

| Category          | Supported                                                            | Notes                    |
| ---               | ---                                                                  | ---                      |
| Deployment        | Docker, Railway, Vercel                                              | Cloudflare coming soon   |
| LLM providers     | OpenAI, Anthropic, Google, OpenRouter, AI Gateway, Vercel AI Gateway | Bring your own model/key |
| Chat platforms    | Web, Slack, Discord, Microsoft Teams, Google Chat, Linear, GitHub    | Whatsapp comming soon    |
| Database adapters | SQLite, Postgres, MySQL                                              |                          |
| State adapters    | Database, Redis, Memory                                              |                          |
| MCP transports    | HTTP, SSE, stdio                                                     |                          |
| Built-in plugins  | Linear                                                               | Notion comming soon      |
