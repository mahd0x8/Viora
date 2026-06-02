# Stage 1 — production dependencies only (no devDeps)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2 — full install + Next.js build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3 — lean production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Production node_modules (includes tsx — moved to dependencies)
COPY --from=deps /app/node_modules ./node_modules

# Next.js build output
COPY --from=builder /app/.next ./.next

# Static assets
COPY --from=builder /app/public ./public

# Files needed at runtime
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server.ts"]
