# Environment Configuration Notes

Use this folder to document non-secret configuration per environment. Examples:

- `dev.env.example`: shows required environment variables for the dev n8n instance (dummy values only).
- `staging.env.example`, `prod.env.example`: document endpoint/feature toggles unique to each cluster.

> ⚠️ Do **not** store any actual credentials or tokens here. Sensitive values stay in 1Password and are synced into Kubernetes via the 1Password Operator.
