FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
ARG NPM_CONFIG_OFFLINE=false
RUN --mount=type=cache,id=afara-npm,target=/root/.npm --mount=type=secret,id=network_proxy --mount=type=secret,id=proxy_ca     if [ -f /run/secrets/network_proxy ]; then export HTTPS_PROXY="$(cat /run/secrets/network_proxy)" HTTP_PROXY="$(cat /run/secrets/network_proxy)"; fi;     if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi;     npm ci --offline="$NPM_CONFIG_OFFLINE" --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000
COPY . .
RUN AFARA_STAGE=build APP_URL=http://localhost:3000 PAYLOAD_SECRET=$(node -p "require('crypto').randomBytes(32).toString('hex')") npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
ARG NPM_CONFIG_OFFLINE=false
# Keep one application layer, including source required by the migration CLI
# and worker. Do not copy the standalone traced node_modules a second time.
RUN --mount=type=cache,id=afara-npm,target=/root/.npm \
    --mount=type=secret,id=network_proxy --mount=type=secret,id=proxy_ca \
    --mount=type=bind,from=build,source=/app,target=/build,ro \
    if [ -f /run/secrets/network_proxy ]; then export HTTPS_PROXY="$(cat /run/secrets/network_proxy)" HTTP_PROXY="$(cat /run/secrets/network_proxy)"; fi; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --omit=dev --offline="$NPM_CONFIG_OFFLINE" --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 && \
    cp /build/.next/standalone/server.js ./server.js && \
    mkdir -p .next media && \
    cp -a /build/.next/standalone/.next/. .next/ && \
    cp -a /build/.next/static .next/static && \
    cp -a /build/public /build/src /build/scripts /build/content /build/tsconfig.json . && \
    chown -R node:node /app
USER node
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
