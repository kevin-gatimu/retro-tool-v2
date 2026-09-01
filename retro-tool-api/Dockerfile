FROM node:24-bookworm-slim AS builder

WORKDIR /workspace
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter retro-tool-api build
RUN pnpm --filter retro-tool-api deploy --prod --legacy /app

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app ./
COPY --from=builder /workspace/retro-tool-api/dist ./dist

EXPOSE 8080

CMD ["node", "dist/main.js"]
