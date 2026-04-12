FROM node:24-bookworm-slim AS builder

WORKDIR /workspace
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.0.0-rc.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter retro-tool-api build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /workspace/retro-tool-api/package.json ./package.json
COPY --from=builder /workspace/retro-tool-api/dist ./dist

RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

EXPOSE 8080

CMD ["node", "dist/main.js"]
