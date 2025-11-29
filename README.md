# Oremus Labs n8n GitOps Repository

This repository tracks every n8n workflow, shared asset, and automation script needed to keep our dev/stage/prod instances in sync via GitOps. The long term goal is to treat n8n flows like code: PR-based changes, automated verification, and auditable promotions into each Kubernetes environment.

## Workflow Content Layout

```
ol-n8n/
├── workflows/           # one folder per workflow (JSON, docs, tests)
├── shared/
│   ├── env/             # sample env-var manifests or documentation per env
│   └── snippets/        # reusable code snippets, expressions, etc.
└── ci/                  # validation & import/export utilities
```

Each workflow lives in `workflows/<workflow-name>/workflow.json`. Optional subfolders (`schemas/`, `tests/`, etc.) live alongside. Use kebab-case names to keep paths deterministic.

## Phase Plan & Status

| Phase | Scope | Status |
| --- | --- | --- |
| **1. Repository scaffolding & conventions** | Create base tree, README, placeholder dirs, coding conventions. | ✅ Complete |
| **2. Developer tooling** | Add export/import helpers, schema validation boilerplate, README for contributors. | ✅ Complete |
| **3. CI-driven workflow sync** | GitHub Actions pipeline to deploy to staging & prod via n8n API, with approvals. | ✅ Complete (self-hosted runner) |
| **4. In-cluster reconciler & drift alerts** | Kubernetes CronJob/sidecar that periodically re-syncs from Git and flags drift. | ⏳ Planned |
| **5. Observability & policy** | Dashboards/alerts for sync jobs, documentation on access control & runbooks. | ⏳ Planned |

Each phase builds on the previous one. We will update the status column (✅/🚧/⏳) as work progresses.

## Getting Started

1. Export the workflow you modified from your **dev n8n** instance (Settings → Export). Drop it into `workflows/<name>/workflow.json`.
2. Add any supporting files (schemas, fixtures) inside the same folder.
3. Run upcoming validation scripts (Phase 2) locally before opening a PR.
4. Submit a PR against `main`. Merges to `main` will eventually trigger the automated sync pipeline (Phase 3).

## Environment Notes

* **Secrets:** No secrets belong in this repo. Reference credentials by name in workflows; the actual values live in 1Password and are mounted into pods via the 1Password Operator.
* **Workflow IDs:** Keep the `id` property in JSON for traceability, but assume new environments will assign fresh IDs. Our sync tooling will handle create vs update logic.
* **Naming:** Re-use the exact credential names across dev/stage/prod so imports resolve automatically.

## Next Steps

## Developer Tooling

Phase 2 shipped the first set of contributor utilities:

- `ci/export_all.sh` – pull every workflow from any n8n instance via REST and mirror it into `workflows/`.
- `ci/import_all.sh` – push all tracked workflows into a target instance (idempotent create/update).
- `npm run validate` – schema/policy checks for every `workflow.json` (ensures valid structure and prevents committing `active: true`).

### Requirements

- `jq` 1.6+
- `curl`
- Node.js 18+ (run `npm install` once to install the dev dependency `ajv`).

### Typical Flow

1. Export from dev: `N8N_API_URL=... N8N_API_KEY=... ci/export_all.sh`.
2. Edit/review JSON + supporting assets.
3. Run `npm run validate` before opening a PR.
4. Import into a test instance (optional): `N8N_API_URL=... ci/import_all.sh`.

These scripts will be invoked by CI/CD in Phase 3, so keep them deterministic and ensure they work locally.

## Next Steps

Phase 3 wired the repo into GitHub Actions so merges automatically deploy to staging/prod.

## Continuous Deployment (Phase 3)

`.github/workflows/deploy.yml` now automates the promotion pipeline:

1. **validate** – runs on `ubuntu-latest`, executes `npm ci && npm run validate`.
2. **deploy-staging** – runs on a self-hosted runner (label `n8n`) that can reach the private n8n service. Imports all workflows via `ci/import_all.sh` using `STAGING_N8N_URL` + `STAGING_N8N_API_KEY` secrets. Targets the `staging` GitHub environment.
3. **deploy-production** – same as staging, but gated by the `production` environment for manual approval. Uses `PROD_N8N_URL` + `PROD_N8N_API_KEY` secrets.

### Required Secrets / Environments

Create these secrets in GitHub (scoped to the repository environments):

| Secret | Description |
| --- | --- |
| `STAGING_N8N_URL` | Base URL reachable from the self-hosted runner (e.g. `http://n8n.n8n.svc.cluster.local:5678`). |
| `STAGING_N8N_API_KEY` | Personal API token for the staging n8n instance. |
| `PROD_N8N_URL` | Production base URL. |
| `PROD_N8N_API_KEY` | Production personal API token. |

The production environment should require manual approval in GitHub so deployments halt until an operator reviews staging.

### Self-Hosted Runner Requirement

Because the n8n instances live on a private network, public GitHub runners cannot reach them. Provision a self-hosted runner with the `n8n` label:

1. Deploy a VM or Kubernetes pod inside the network (e.g. via [actions-runner-controller](https://github.com/actions/actions-runner-controller)).
2. Register it against this repository with labels `self-hosted,n8n`.
3. Ensure it has access to `git`, `bash`, `jq`, `curl`, and Node.js 20+.
4. Expose DNS (or host entries) so it can reach the staging/prod n8n base URLs defined above.

The workflow’s `runs-on: [self-hosted, n8n]` constraint guarantees only that private runner handles deploy steps.

## Next Steps

Phase 4 will add an in-cluster reconciler / drift detection job that periodically reapplies Git state and raises alerts if someone edits workflows directly in n8n.
