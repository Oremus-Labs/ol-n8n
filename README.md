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
| **2. Developer tooling** | Add export/import helpers, schema validation boilerplate, README for contributors. | ⏳ Planned |
| **3. CI-driven workflow sync** | GitHub Actions pipeline to deploy to staging & prod via n8n API, with approvals. | ⏳ Planned |
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

Phase 2 will introduce developer tooling (export helpers + JSON schema validation). Track progress in this README.
