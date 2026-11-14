# Build context is the repo root (see docker-compose.yml) so this stage can
# run the extension's own build unmodified.
# The build output is platform-independent, so build natively once instead of under
# QEMU per target arch (where pnpm install crawls or hangs); only the runtime stage is per-arch.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Runtime image only needs the sidecar server + the extension's build output (the browser shim
# included) — no node_modules, no source, no build tooling. Node strips server.ts's types itself.
FROM node:22-alpine
WORKDIR /app
COPY docker/server.ts ./
COPY --from=build /repo/.output/chrome-mv3 /assets
COPY --from=build /repo/package.json /app/package.json
# Edge builds stamp their commit here; releases use package.json's version.
ARG ABT_VERSION
ENV ABT_VERSION=$ABT_VERSION
ENV PORT=3005
EXPOSE 3005
# The image's unprivileged user; the server only needs to read its files.
USER node
CMD ["node", "server.ts"]
