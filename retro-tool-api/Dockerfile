FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /workspace

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY retro-tool-api/package.json retro-tool-api/package.json
COPY packages/shared/contracts/package.json packages/shared/contracts/package.json
RUN pnpm install --frozen-lockfile --filter retro-tool-api...

FROM deps AS build

COPY packages/shared/contracts packages/shared/contracts
COPY retro-tool-api retro-tool-api

WORKDIR /workspace/retro-tool-api
RUN pnpm build

FROM base AS runtime

ENV NODE_ENV=production

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY retro-tool-api/package.json retro-tool-api/package.json
COPY packages/shared/contracts/package.json packages/shared/contracts/package.json
RUN pnpm install --prod --frozen-lockfile --filter retro-tool-api... --ignore-scripts
COPY --from=build /workspace/retro-tool-api/dist ./retro-tool-api/dist
COPY --from=build /workspace/retro-tool-api/drizzle ./retro-tool-api/drizzle
COPY --from=build /workspace/retro-tool-api/package.json ./retro-tool-api/package.json

WORKDIR /workspace/retro-tool-api

EXPOSE 8000

CMD ["node", "dist/main"]