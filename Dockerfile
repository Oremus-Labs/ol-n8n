# Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY tsconfig.n8n-mcp.json tsconfig.n8n-mcp.json
COPY tsconfig.schemas.json tsconfig.schemas.json
COPY ci ./ci
RUN npm ci \
 && npm run build:client \
 && npm run build:schema \
 && npm prune --omit=dev

# Runtime image
FROM node:20-alpine
WORKDIR /importer
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/ci/import_all.mjs ./import_all.mjs
COPY --from=deps /app/ci/workflow-schema.json ./workflow-schema.json
COPY --from=deps /app/ci/vendor ./vendor
ENTRYPOINT ["node", "/importer/import_all.mjs"]
