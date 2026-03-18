FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps

ENV NODE_ENV=production

RUN bun install --frozen-lockfile
RUN bun run build --filter=server --filter=web
RUN bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile server \
  ./apps/server/src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/server server

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./server"]
