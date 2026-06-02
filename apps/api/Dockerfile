# Debian slim instead of Alpine — Prisma's prebuilt engines target glibc +
# openssl 3 cleanly on Debian, avoiding the recurring Alpine/musl openssl
# detection issues ("Prisma failed to detect the libssl/openssl version").
FROM node:20-slim AS deps
WORKDIR /repo
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/

# npm workspaces hoist to root node_modules; no per-workspace dirs to copy.
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# ---- build ----
FROM node:20-slim AS build
WORKDIR /repo
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /repo/node_modules ./node_modules

COPY tsconfig*.json* ./
COPY packages packages
COPY apps/api apps/api

# Build @hrms/contracts to JS first — the API resolves it via workspace lookup
# and consumes its compiled `dist/`. Without this step the runtime would try
# to load the TS source (main pointed at .ts) and fail to resolve.
WORKDIR /repo/packages/contracts
RUN npx tsc

WORKDIR /repo/apps/api
# Prisma reads DATABASE_URL eagerly in some generators; placeholder so
# `generate` never tries to connect.
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Multi-step build with explicit failure handling so a silent miss surfaces.
RUN set -eux \
 && npx prisma generate --schema prisma/registry.prisma \
 && npx prisma generate --schema prisma/tenant.prisma \
 && npm run build \
 && if [ ! -f dist/main.js ]; then \
      echo 'BUILD FAILED: dist/main.js not produced'; \
      find dist -maxdepth 4 -name 'main.js' -print || true; \
      exit 1; \
    fi \
 && npx tsc prisma/seed.ts \
       --outDir prisma \
       --module commonjs --target es2022 \
       --esModuleInterop --skipLibCheck --resolveJsonModule \
 && test -f prisma/seed.js \
       || (echo 'BUILD FAILED: prisma/seed.js not produced'; ls -la prisma; exit 1)

# ---- runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4000
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy the whole built workspace tree — no clever path picking.
COPY --from=build /repo/node_modules          ./node_modules
COPY --from=build /repo/packages              ./packages
COPY --from=build /repo/apps/api/dist         ./apps/api/dist
COPY --from=build /repo/apps/api/prisma       ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
