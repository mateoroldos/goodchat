FROM oven/bun:1.3.4

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN bun install --frozen-lockfile --verbose

ENV NODE_ENV=production

RUN bunx turbo build --filter=@goodchat/core --filter=@goodchat/plugins --filter=@goodchat/adapter-sqlite --filter=web
RUN bun ./scripts/copy-web-assets.mjs

EXPOSE 3000

CMD ["bun", "apps/server/src/index.ts"]
