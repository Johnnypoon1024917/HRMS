# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY packages packages
COPY apps/web apps/web

# Build @hrms/contracts to JS — its package.json `main`/`types` point at
# dist/, and Next's runtime SSR loads the package via Node module resolution
# (transpilePackages handles client-side bundling but not require() at SSR).
WORKDIR /repo/packages/contracts
RUN npx tsc

WORKDIR /repo/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Next bakes rewrite destinations into the routes manifest at build time, so
# API_URL must be set HERE (not just at container runtime). Inside docker
# compose the api is reachable at http://api:4000.
ENV API_URL=http://api:4000
RUN npm run build \
 && test -d .next/server || (echo 'BUILD FAILED: .next/server missing'; ls -la .next || true; exit 1)

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=5000 NEXT_TELEMETRY_DISABLED=1

# Copy the whole built workspace tree — robust, no standalone path picking.
COPY --from=build /repo/node_modules             ./node_modules
COPY --from=build /repo/packages                 ./packages
COPY --from=build /repo/apps/web/.next           ./apps/web/.next
COPY --from=build /repo/apps/web/public          ./apps/web/public
COPY --from=build /repo/apps/web/package.json    ./apps/web/package.json
COPY --from=build /repo/apps/web/next.config.mjs ./apps/web/next.config.mjs

EXPOSE 5000
WORKDIR /app/apps/web
# Direct binary — skips `npx`'s lookup roundtrip on every container start.
# `-H 0.0.0.0` forces binding to all interfaces (vs. just loopback inside the
# container, which would make the host port mapping silently unreachable).
CMD ["node", "../../node_modules/next/dist/bin/next", "start", "-p", "5000", "-H", "0.0.0.0"]
