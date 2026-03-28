FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /workspace

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY retro-tool-ui/package.json retro-tool-ui/package.json
COPY packages/shared/contracts/package.json packages/shared/contracts/package.json
RUN pnpm install --frozen-lockfile --filter retro-tool-ui...

FROM deps AS build

COPY packages/shared/contracts packages/shared/contracts
COPY retro-tool-ui retro-tool-ui

ARG VITE_APP_ENV=development
ARG VITE_API_URL=http://localhost:8000
ARG VITE_APP_TITLE=Retro Tool
ARG VITE_CONVEX_URL=
ARG VITE_ESTIMATES_REALTIME_BACKEND=socket-io
ARG VITE_RETROS_REALTIME_BACKEND=socket-io
ARG VITE_NOTIFICATIONS_REALTIME_BACKEND=socket-io
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_ESTIMATES_REALTIME_BACKEND=$VITE_ESTIMATES_REALTIME_BACKEND
ENV VITE_RETROS_REALTIME_BACKEND=$VITE_RETROS_REALTIME_BACKEND
ENV VITE_NOTIFICATIONS_REALTIME_BACKEND=$VITE_NOTIFICATIONS_REALTIME_BACKEND

WORKDIR /workspace/retro-tool-ui
RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY retro-tool-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/retro-tool-ui/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]