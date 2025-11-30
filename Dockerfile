# Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY ci/scripts ./ci/scripts
RUN npm ci --omit=dev
COPY ci/import_all.mjs ci/workflow-schema.json ./ci/

# Runtime image
FROM node:20-alpine
WORKDIR /importer
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/ci/import_all.mjs ./import_all.mjs
COPY --from=deps /app/ci/workflow-schema.json ./workflow-schema.json
ENTRYPOINT ["node", "/importer/import_all.mjs"]
