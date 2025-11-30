# CI Utilities

Helper scripts for working with the n8n GitOps repo.

## Prerequisites

- `jq` installed locally (for `export_all.sh`).
- `curl` (already available on most systems).
- Node.js 18+ (run `npm install` once to install dependencies for the Node-based tooling).

## Scripts

### `ci/export_all.sh`
Exports every workflow from a running n8n instance into the `workflows/` tree using the REST API.

Usage:

```
N8N_API_URL="https://n8n.dev.example.com" \
N8N_API_KEY="<personal-api-key>" \
ci/export_all.sh [output-dir]
```

The script slugifies workflow names into folder names and writes `workflow.json` plus metadata for each workflow.

### `ci/import_all.mjs`
Imports or updates every `workflow.json` under `workflows/` using the official `@n8n/rest-api-client`. Each workflow is validated against `ci/workflow-schema.json` (generated from the SDK types) before it is sent to the API.

```
npm install               # first time only
N8N_API_URL="https://n8n.staging.example.com" \
N8N_API_KEY="<personal-api-key>" \
npm run import
```

Existing workflows that contain an `id` field are updated via `PUT`; others are created via `POST`. Set `N8N_PUSH_REF` to override the commit reference tagged in workflow versions (defaults to `git-sync`).

### `npm run build:schema`
Regenerates `ci/workflow-schema.json` from the official REST client TypeScript definitions. Run this whenever the SDK is upgraded.

### `npm run validate`
Runs schema + policy checks against every committed workflow (used by CI).
