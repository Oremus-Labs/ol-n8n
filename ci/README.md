# CI Utilities

Scripts and configs that power validation + workflow sync:

- `validate.js` (Phase 2): JSON schema + static analysis checks run before deploying.
- `export_all.sh` / `import_all.sh`: helper scripts wrapping the n8n CLI for bulk operations.
- GitHub Actions workflows live under `.github/workflows/` (to be added in Phase 3).

Keep scripts idempotent so they can run locally and inside CI runners.
