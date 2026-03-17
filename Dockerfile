# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

ARG DASHCLAW_MODE
ARG NEXT_PUBLIC_DASHCLAW_MODE
ENV DASHCLAW_MODE=${DASHCLAW_MODE}
ENV NEXT_PUBLIC_DASHCLAW_MODE=${NEXT_PUBLIC_DASHCLAW_MODE}

RUN cd examples/openai-governed-agent && npm install

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

ARG DASHCLAW_MODE
ENV DASHCLAW_MODE=${DASHCLAW_MODE:-demo}
ENV NEXT_PUBLIC_DASHCLAW_MODE=${DASHCLAW_MODE:-demo}

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/examples/openai-governed-agent ./examples/openai-governed-agent
COPY --from=builder /app/scripts/demo-entrypoint.mjs ./scripts/demo-entrypoint.mjs

RUN cd examples/openai-governed-agent && npm install

RUN chown -R nextjs:nodejs /app/examples /app/scripts

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

CMD ["node", "/app/scripts/demo-entrypoint.mjs"]
