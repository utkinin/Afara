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
RUN --mount=type=cache,id=afara-npm,target=/root/.npm --mount=type=secret,id=network_proxy --mount=type=secret,id=proxy_ca     if [ -f /run/secrets/network_proxy ]; then export HTTPS_PROXY="$(cat /run/secrets/network_proxy)" HTTP_PROXY="$(cat /run/secrets/network_proxy)"; fi;     if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi;     npm ci --omit=dev --offline="$NPM_CONFIG_OFFLINE" --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node tsconfig.json ./
RUN mkdir -p /app/media && chown node:node /app/media
USER node
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
