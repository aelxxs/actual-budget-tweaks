# Build context is the repo root (see docker-compose.yml) so this stage can
# run the extension's own build unmodified.
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Runtime image only needs the sidecar server + the extension's build output —
# no node_modules, no source, no build tooling.
FROM node:20-alpine
WORKDIR /app
COPY docker/server.js docker/browser-shim.js ./
COPY --from=build /repo/.output/chrome-mv3 /assets
COPY --from=build /repo/package.json /app/package.json
ENV PORT=3005
EXPOSE 3005
CMD ["node", "server.js"]
