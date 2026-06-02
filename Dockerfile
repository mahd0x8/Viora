# syntax=docker/dockerfile:1
# Stage 1 — install and build
FROM node:20-slim AS builder
WORKDIR /app

# Explicit filenames — no glob that might silently drop package-lock.json
COPY package.json package-lock.json ./

# Cache mount keeps downloaded packages across rebuilds; host network resolves DNS
RUN --mount=type=cache,target=/root/.npm \
    NODE_OPTIONS="--max-old-space-size=2048" npm ci --no-fund --no-audit

COPY . .
RUN ./node_modules/.bin/next build

# Stage 2 — production image
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm prune --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server.ts"]
