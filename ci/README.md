# CI Utilities

Helper scripts for working with the n8n GitOps repo.

## Prerequisites

- Node.js 18+ (run `npm install` once to install dependencies for the Node-based tooling).

## Scripts

### `ci/import_all.mjs`
Imports or updates every `workflow.json` under `workflows/` using the `N8nApiClient` from the [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) project. Each workflow is validated against `ci/workflow-schema.json` before it is sent to the API, and the vendored client performs an additional cleanup pass (`cleanWorkflowForCreate/Update`) so that we only submit properties the API accepts.

```
npm install               # first time only
N8N_API_URL="https://n8n.staging.example.com" \\
N8N_API_KEY="<personal-api-key>" \\
npm run import [optional-path-to-workflows]
```

Existing workflows that contain an `id` field are updated via `PUT`; others are created via `POST`. Set `N8N_PUSH_REF` to override the commit reference tagged in workflow versions (defaults to `git-sync`).

The n8n-mcp client code lives in `ci/vendor/n8n-mcp/src`. It is compiled to CommonJS (`ci/vendor/n8n-mcp/dist`) via `npm run build:client`, which runs automatically during `npm install` and as part of the Docker build. If you update any of the vendored files, rerun `npm run build:client` so the dist artifacts stay in sync.

### Containerized importer

The Dockerfile at the repo root builds `ghcr.io/oremus-labs/n8n-git-sync:latest`, a tiny Node 20 image that bundles `ci/import_all.mjs`, the JSON schema, and all runtime dependencies. The Kubernetes CronJob uses this image so pods no longer need to run `npm ci` on every sync.

Rebuild and push after modifying the importer or dependencies:

```
docker build -t ghcr.io/oremus-labs/n8n-git-sync:latest .
docker push ghcr.io/oremus-labs/n8n-git-sync:latest
```

Set `WORKFLOWS_DIR` (or pass a positional argument) when running the container so it knows where the git-synced `workflows/` tree lives.

### `npm run build:schema`
Regenerates `ci/workflow-schema.json` from the official REST client TypeScript definitions. Run this whenever the SDK is upgraded.

### `npm run validate`
Runs schema + policy checks against every committed workflow (used by CI).
