# goodchat

`goodchat` is a minimalistic framework for building and deploying AI-powered chatbots across Slack, Discord, Microsoft Teams, and Google Chat — from a single bot module.

## How to use

Create your bot in `src/goodchat.ts` with `createGoodchat`:

```ts
import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app } = await createGoodchat({
  name: "Linear Assistant",
  prompt:
    "You are a Linear assistant. Respond briefly with what I have on Linear.",
  platforms: ["web", "discord"],
  plugins: [linear],
  withDashboard: true,
  isServerless,
});

export { app };
```

Bot IDs are derived from the name (for example `Linear Assistant` becomes `Linear Assistant`).

Goodchat runs one bot per server. Changes require a rebuild and redeploy.

Then run:

```bash
goodchat dev
```

Your bot is live. Connect it to Slack or Discord in the dashboard at `http://localhost:3000` with one click — no webhook URLs, no API key copying.

---

## Features

### One config. Every platform

Write your bot logic once. `goodchat` handles the adapter layer, webhook routing, and message formatting for each platform automatically.

```ts
await createGoodchat({
  name: "support-bot",
  prompt: "You are a support assistant. Answer questions about our product.",
  platforms: ["slack", "discord", "teams", "google-chat"],
});
```

Deploy once. Works everywhere.

### Context — give your bot knowledge

Attach files, URLs, or folders as context. Your bot will use them to answer questions.

```ts
await createGoodchat({
  name: "docs-bot",
  prompt:
    "You are a documentation assistant. Answer only based on the provided docs.",
  platforms: ["slack"],
  context: [
    { type: "url", src: "https://docs.acme.com" },
    { type: "file", src: "./docs/faq.pdf" },
    { type: "folder", src: "./knowledge-base" },
  ],
});
```

Context is chunked, embedded, and retrieved automatically. It re-indexes whenever your sources change.

### Streaming responses

Responses stream in real time across every connected platform. Users see the bot typing progressively — no waiting for a complete reply.

```ts
await createGoodchat({
  name: "my-bot",
  prompt: "...",
  platforms: ["slack"],
  streaming: true, // default
});
```

### Tools — let your bot take actions

Give your bot the ability to look things up, check statuses, or call your APIs in real time.

```ts
import { tool } from "goodchat";
import { z } from "zod";

await createGoodchat({
  name: "support-bot",
  prompt: "You are a support assistant. You can look up order statuses.",
  platforms: ["slack"],
  tools: {
    getOrderStatus: tool({
      description: "Look up the status of a customer order by ID",
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        const order = await db.orders.find(orderId);
        return order.status;
      },
    }),
  },
});
```

### Escalation — know when to hand off

Define when the bot should stop and bring a human in.

```ts
await createGoodchat({
  name: "support-bot",
  prompt: "...",
  platforms: ["slack"],
  escalation: {
    trigger:
      "when the user is frustrated or the question is outside your knowledge",
    action: { type: "tag", user: "@support-team" },
  },
});
```

The bot will gracefully hand off the conversation instead of guessing.

### Events — react to what happens

Go beyond responding to messages. React to reactions, new members joining, threads being created, and more.

```ts
await createGoodchat({
  name: "community-bot",
  prompt: "...",
  platforms: ["discord"],
  events: {
    onMemberJoin: async ({ member, thread }) => {
      await thread.post(
        `Welcome ${member.name}! 👋 Ask me anything to get started.`,
      );
    },
    onReaction: async ({ emoji, message, thread }) => {
      if (emoji === "❓") {
        await thread.post("Looks like someone has a question — let me help.");
      }
    },
  },
});
```

### Plugins — extend with one line

Plugins are pre-built, shareable bundles of tools, context loaders, event handlers, and prompt fragments. Install one and your bot instantly gains new capabilities.

```bash
npm install @goodchat/plugin-github
npm install @goodchat/plugin-linear
npm install @goodchat/plugin-stripe
```

```ts
import { github } from "@goodchat/plugins/github";
import { linear } from "@goodchat/plugins/linear";

await createGoodchat({
  name: "dev-bot",
  prompt: "You are an assistant for our engineering team.",
  platforms: ["slack"],
  plugins: [
    github({ repo: "acme/backend", token: process.env.GITHUB_TOKEN }),
    linear({ team: "ENG", token: process.env.LINEAR_TOKEN }),
  ],
});
```

Now your bot can look up open PRs, check issue statuses, create Linear tickets — without writing a single tool. The plugins register their tools, context, and event handlers automatically.

Plugins can be configured, composed, and overridden:

```ts
plugins: [
  github({
    repo: "acme/backend",
    token: process.env.GITHUB_TOKEN,
    // only expose specific tools
    tools: ["getPR", "listOpenIssues"],
  }),
];
```

---

## Extending goodchat

### Writing your own plugin

A plugin is just a function that returns a `BotPlugin` object. It can contribute tools, context sources, event handlers, and prompt fragments — all of which get merged into the bot at runtime.

```ts
import { definePlugin, tool } from "goodchat";
import { z } from "zod";

export const myPlugin = definePlugin((options) => ({
  // Injected into the system prompt automatically
  promptFragment: "You can look up inventory levels when asked.",

  // Tools registered on the bot
  tools: {
    getInventory: tool({
      description: "Get current inventory for a product SKU",
      parameters: z.object({ sku: z.string() }),
      execute: async ({ sku }) => {
        return await myApi.inventory.get(sku);
      },
    }),
  },

  // Context sources added to the RAG pipeline
  context: [{ type: "url", src: options.docsUrl }],

  // Event handlers merged with the bot's own
  events: {
    onMemberJoin: async ({ member, thread }) => {
      await thread.post(
        `Hey ${member.name}, ask me about stock levels anytime.`,
      );
    },
  },
}));
```

Use it like any other plugin:

```ts
import { myPlugin } from "./plugins/my-plugin";

await createGoodchat({
  name: "ops-bot",
  prompt: "...",
  platforms: ["slack"],
  plugins: [myPlugin({ docsUrl: "https://internal.acme.com/inventory" })],
});
```

### Writing your own adapter

Need a platform not yet supported? Adapters wrap the Vercel Chat SDK and teach `goodchat` how to speak a new platform's language.

```ts
import { defineAdapter } from "goodchat";

export const myPlatform = defineAdapter({
  name: "my-platform",

  // Parse the incoming webhook into goodchat's internal message format
  parseWebhook(req) {
    return {
      threadId: req.body.conversation_id,
      userId: req.body.user_id,
      text: req.body.text,
    };
  },

  // Send a response back to the platform
  async sendMessage({ threadId, text, stream }) {
    await myPlatformApi.messages.send({ conversation_id: threadId, text });
  },
});
```

Register it in your config:

```ts
import { myPlatform } from "./adapters/my-platform";

await createGoodchat({
  name: "my-bot",
  prompt: "...",
  adapters: [myPlatform()],
});
```

### Middleware — intercept every message

Middleware runs before and after every message cycle. Use it for logging, rate limiting, content filtering, or injecting context dynamically.

```ts
import { defineMiddleware } from "goodchat";

const rateLimiter = defineMiddleware({
  name: "rate-limiter",
  before: async ({ message, user, next }) => {
    const count = await redis.incr(`msg:${user.id}`);
    if (count > 10) return message.reply("Slow down — try again in a minute.");
    return next();
  },
});

const logger = defineMiddleware({
  name: "logger",
  before: async ({ message, next }) => {
    console.log(`[${message.platform}] ${message.userId}: ${message.text}`);
    return next();
  },
  after: async ({ message, response }) => {
    console.log(`[response] ${response.text.slice(0, 80)}...`);
  },
});

await createGoodchat({
  name: "my-bot",
  prompt: "...",
  platforms: ["slack"],
  middleware: [rateLimiter, logger],
});
```

### Custom context loaders

Need to pull context from a source not built in? Define your own loader.

```ts
import { defineContextLoader } from "goodchat";

const notionLoader = defineContextLoader({
  type: "notion",
  load: async (src) => {
    const pages = await notion.databases.query({ database_id: src });
    return pages.results.map((p) => ({
      content: p.properties.content.rich_text[0].plain_text,
      metadata: { id: p.id, title: p.properties.title },
    }));
  },
});
```

Register it globally so any bot in your project can use it:

```ts
// apps/server/src/app.ts
import { defineConfig } from "goodchat";

export const config = defineConfig({
  loaders: [notionLoader],
});

await createGoodchat({
  name: "my-bot",
  prompt: "...",
  platforms: ["slack"],
  context: [
    { type: "notion", src: "your-database-id" }, // uses your custom loader
  ],
});
```

---

### Variables — dynamic context per user

Inject runtime data into your prompt using `{{ }}` syntax.

```ts
await createGoodchat({
  name: "onboarding-bot",
  prompt: `
    You are onboarding {{ user.name }} who joined {{ user.company }} on {{ user.startDate }}.
    Their role is {{ user.role }}. Guide them through their first week.
  `,
  platforms: ["slack"],
});
```

Pass variables via the API when triggering the bot programmatically:

```bash
curl -X POST https://your-instance.com/api/bot/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "What should I do first?",
    "variables": {
      "user": { "name": "Sara", "company": "Acme", "role": "Engineer", "startDate": "today" }
    }
  }'
```

---

## Real-world examples

### Customer support bot for a SaaS product

```ts
await createGoodchat({
  name: "support-bot",
  prompt: `
    You are a support assistant for Acme. Help users with product questions.
    Be concise. If you don't know something, say so and tell them to email help@acme.com.
  `,
  platforms: ["slack", "discord"],
  context: [
    { type: "url", src: "https://docs.acme.com" },
    { type: "file", src: "./pricing-faq.pdf" },
  ],
  escalation: {
    trigger: "billing issues, account problems, or angry users",
    action: { type: "tag", user: "@support" },
  },
});
```

### Internal knowledge bot for a team

```ts
await createGoodchat({
  name: "handbook-bot",
  prompt: `
    You are the internal assistant for our team.
    Answer questions about policies, processes, and who owns what.
    Only use the provided context. Never make things up.
  `,
  platforms: ["slack"],
  context: [
    { type: "folder", src: "./notion-export" },
    { type: "url", src: "https://www.notion.so/acme/handbook" },
  ],
});
```

### Community onboarding bot for Discord

```ts
await createGoodchat({
  name: "community-bot",
  prompt: "You help new members get oriented in our developer community.",
  platforms: ["discord"],
  context: [
    { type: "file", src: "./community-rules.md" },
    { type: "url", src: "https://acme.com/community/faq" },
  ],
  events: {
    onMemberJoin: async ({ member, thread }) => {
      await thread.post(
        `Hey ${member.name}! Welcome 👋 — I'm here to help you get started.`,
      );
    },
  },
});
```

---

## Dashboard

Not a developer? Run `goodchat dev` and open `http://localhost:3000`.

The dashboard lets you configure your bot, attach context, connect platforms via OAuth, and read conversation threads. Changes require a rebuild and redeploy.

---

## Deployment

Every bot is ready to deploy the moment you define it.

```bash
goodchat build
goodchat start
```

Or deploy to your own infrastructure with Docker:

```bash
docker run -p 3000:3000 -v $(pwd):/app goodchat/goodchat
```

````

For a managed cloud deployment with zero setup, use [goodchat.dev](https://goodchat.dev).

---

## CLI

```bash
npx create-goodchat@latest  # Scaffold a new bot project
goodchat db schema sync     # Sync generated schema artifacts
goodchat dev             # Start local dev server with hot reload
goodchat build           # Build for production
goodchat start           # Start production server
goodchat threads <name>  # Stream live conversation threads
goodchat deploy          # Deploy to goodchat.dev
````

---

## Self-hosting

`goodchat` is fully self-hostable. You own your data, your prompts, and your infrastructure. No telemetry, no vendor lock-in.

```bash
git clone https://github.com/your-org/goodchat
cp .env.example .env      # Add your LLM API key and platform credentials
docker compose up
```

The cloud version at [goodchat.dev](https://goodchat.dev) is the same codebase — just hosted for you.

---

## Testing database adapters locally

Integration tests manage the Docker lifecycle and default to local URLs if you do not provide env vars:

- `POSTGRES_TEST_URL=postgres://goodchat:goodchat@localhost:5432/postgres`
- `MYSQL_TEST_URL=mysql://root:goodchat@localhost:3306/mysql`

Run the integration suite:

```bash
bun run test:integration
```

Override the database URLs if needed:

```bash
POSTGRES_TEST_URL=postgres://goodchat:goodchat@localhost:5432/postgres \
MYSQL_TEST_URL=mysql://root:goodchat@localhost:3306/mysql \
bun run test:integration
```

Manual control is still available:

```bash
bun run test:db:up
bun run test:db:down
```

---

## Philosophy

Most bot builders make you choose between simplicity and power. `goodchat` doesn't.

The bot package is the product. Everything — prompts, platforms, context, tools, events — lives in one place and is readable by anyone on your team, technical or not. The complexity of multi-platform deployment, webhook routing, and streaming lives in the framework layer so you never have to see it.

---

## Deployment providers

### Railway (Docker)

Use the Dockerfile from the repo root:

```bash
docker build -f apps/server/Dockerfile -t goodchat-server .
```

Then deploy the image on Railway using Dockerfile mode with `apps/server/Dockerfile` and build context set to the repo root. The build uses Turborepo filters for `server` and `web`, and the server reads `PORT` automatically, so Railway's assigned port just works. Set your required environment variables (for example `OPENAI_API_KEY` and any adapter credentials).

### Docker (custom)

Build and run the server image locally or on any container host:

```bash
docker build -f apps/server/Dockerfile -t goodchat-server .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=... \
  goodchat-server
```

The Docker build runs `bun run build` so `apps/web/build` is produced and served by the API.

### Vercel (Bun)

Vercel functions will run the default export from `apps/server/src/index.ts`. The repo includes `vercel.json` to select the Bun runtime.

- Set environment variables in Vercel for `OPENAI_API_KEY` and any platform credentials.
- Serverless deployments skip the config watcher and the static dashboard build. If you want the dashboard, deploy `apps/web` separately as a static site.
- For other serverless providers, set `SERVERLESS=true` to disable file watchers and static file serving.
