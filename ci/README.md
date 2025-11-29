# CI Utilities

Helper scripts for working with the n8n GitOps repo.

## Prerequisites

- `jq` installed locally.
- `curl` (already available on most systems).
- Node.js 18+ (to run the validation script). Run `npm install` once to install dev dependencies.

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

### `ci/import_all.sh`
Imports or updates every `workflow.json` found under the target directory into an n8n instance.

```
N8N_API_URL="https://n8n.staging.example.com" \
N8N_API_KEY="<personal-api-key>" \
ci/import_all.sh [workflows-dir]
```

Existing workflows that contain an `id` field are updated via `PUT`; others are created via `POST`.

### `npm run validate`
Runs schema + policy checks against every committed workflow. This job will be wired into CI in Phase 3.

```
npm install   # first time only
npm run validate
```

Validation fails if workflow JSON is malformed, missing required fields, or marked `active: true`.
