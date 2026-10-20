# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# next.config validates the production configuration at build time. These are
# non-secret placeholders; the real values are supplied only at runtime.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    GOOGLE_OIDC_CLIENT_ID=build \
    GOOGLE_OIDC_CLIENT_SECRET=build \
    GOOGLE_OIDC_ISSUER=https://accounts.google.com \
    GOOGLE_OIDC_REDIRECT_URI=https://build.invalid/api/auth/google/callback \
    ADMIN_EMAILS=
RUN npm run build

# One-shot schema migration from the hand-written SQL journal.
FROM deps AS migrate
COPY drizzle.config.ts ./
COPY db ./db
CMD ["npm", "run", "db:migrate"]

FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.js"]
