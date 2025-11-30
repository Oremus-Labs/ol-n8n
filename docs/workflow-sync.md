## Workflow Sync Architecture

### Goals
- Git repository is the **source of truth** for production workflows.
- n8n UI remains the authoring surface, but any change must be exported to git for review.
- Both sync directions must be executable via MCP so automation and remote verification remain possible.

### Components

#### 1. Git Sync Workflow (repo ➜ n8n)
- **Triggers:** cron (every 30 minutes), manual button, and MCP webhook (`git-sync-mcp`).
- **Steps:** list repo tree, download every `workflows/**/workflow.json`, normalize payload, update by `id` when available or `POST` when missing.
- **Safety:** skip workflows tagged `no-sync` (e.g., helper workflows), handle each file independently via `$input.all()`, and set workflow settings `availableInMCP: true`.
- **Result:** n8n mirrors the reviewed git state after every run.

#### 2. n8n-to-Repo Sync Workflow (n8n ➜ repo)
- **Triggers:** manual, schedule, and MCP webhook (`n8n-to-repo-mcp` to be added).
- **Steps:** list workflows through `/api/v1/workflows`, filter by tags/project, fetch full definitions, scrub runtime-only metadata, map to deterministic paths (`workflows/<slug>/workflow.json`), diff vs local files, and write changes. Follow up with `git status` for review or auto-commit if desired.
- **Safety:** exclude Git Sync / n8n-to-Repo workflows themselves via tag, require explicit allowlist before exporting sensitive automations, and use hash comparison to avoid needless commits.
- **Result:** developer can commit + push new/edited workflows from n8n, feeding the Git Sync pipeline.

### MCP Execution Details
- MCP bridge uses `supergateway` pointed at `https://8n8.oremuslabs.app/mcp-server/http` with headers:
  - `Authorization: Bearer <token>`
  - `Accept: application/json, text/event-stream`
- Available tools: `execute_workflow`, `get_workflow_details`, `search_workflows`.
- Trigger Git Sync via:
  ```shell
  curl -sS -X POST https://8n8.oremuslabs.app/mcp-server/http \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"execute_workflow","arguments":{"workflowId":"QNoVZU40nl4mmTEN","inputs":{"type":"webhook","webhookData":{"method":"POST"}}}}}'
  ```
- n8n-to-Repo will expose a similar webhook (`n8n-to-repo-mcp` once implemented); the MCP call stays the same with the workflow ID swapped.

### Constraints & Notes
- GitHub token (`GITHUB_TOKEN`) and n8n API key must be present in the environment for HTTP nodes.
- n8n workflows exporting themselves must remove read-only fields (`active`, `tags`, runtime data) before hitting the git filesystem.
- Use slugified workflow names to avoid path clashes; when manual folder overrides are needed, store metadata inside the workflow (e.g., via `Set` node).
- Avoid recursive sync: never let Git Sync import n8n-to-Repo JSON or vice versa unless explicitly intended.
- MCP execution requires `availableInMCP: true` and active workflows; remember to toggle back on after re-imports.

### End-to-End Verification Checklist (Mandatory)
1. **Repo ➜ n8n:** run Git Sync via MCP, confirm the target workflow updates (check execution log for `Update Workflow (PUT)` results and validate the workflow list in n8n).
2. **n8n ➜ Repo:** create or edit a workflow in n8n, run n8n-to-Repo Sync (UI or MCP), verify new/updated `workflows/**/workflow.json` files, and ensure git diff looks correct.
3. **Round Trip:** commit + push the exported files and re-run Git Sync, ensuring the workflow in n8n matches the committed JSON.
4. **MCP Health:** trigger both workflows via MCP webhooks to ensure remote automation functions (watch SSE output for completion).

All future changes to either workflow must include this verification loop so we never regress the bi-directional sync guarantees.
