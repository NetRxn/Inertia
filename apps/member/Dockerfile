# Member app image. Two targets:
#   runner  the production server (Next.js standalone output), the default
#   tools   full source and dependencies, for scripts run with tsx
#           (check-integrations, seed, connectors)
# Built by the docker-compose.yml at the repo root.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS tools
COPY . .
ENV NODE_ENV=production
CMD ["npx", "tsx", "scripts/check-integrations.ts"]

FROM tools AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Migrations run at startup (src/instrumentation.ts) from ./drizzle.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# Uploads, dev-mail login links, funding.json and connector state live here.
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
