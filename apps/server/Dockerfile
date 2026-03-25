FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/plugins/package.json ./packages/plugins/package.json
COPY packages/styles/package.json ./packages/styles/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY scripts ./scripts

RUN bun install

COPY apps ./apps
COPY packages ./packages

ENV NODE_ENV=production

RUN bunx turbo build --filter=@goodchat/core --filter=@goodchat/plugins --filter=web
RUN bun ./scripts/copy-web-assets.mjs

EXPOSE 3000

CMD ["bun", "apps/server/src/index.ts"]
