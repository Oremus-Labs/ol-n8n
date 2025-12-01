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
- **Triggers:** manual, schedule, and MCP webhook (`n8n-to-repo-mcp`).
- **Steps:** list workflows through `/api/v1/workflows`, flatten the response, run the Filter Workflows function to drop helpers (skips IDs `QNoVZU40nl4mmTEN` / `WCmzFI4sbs3AbgEF`, any workflow tagged `no-sync`/`helper`, anything missing the optional allowlist envs), fetch full definitions, scrub runtime-only metadata while preserving `id`/`active`/`settings`, map to deterministic paths (`workflows/<slug>/workflow.json`), diff vs GitHub via SHA lookup, and PUT the Base64 payload. Follow up with `git pull` locally so repo state matches what was written by the workflow.
- **Safety:** helper filters ensure we never export the sync workflows themselves, `N8N_EXPORT_TAG`/`N8N_EXPORT_ALLOWLIST` enforce explicit approval when needed, `gitSyncPath` overrides (see below) keep legacy directories intact, and every request runs with continue-on-error safeguards so one bad workflow doesn’t block the rest.
- **Result:** developer can commit + push new/edited workflows from n8n, feeding the Git Sync pipeline.

### MCP Execution Details
- MCP bridge uses `supergateway` pointed at `https://8n8.oremuslabs.app/mcp-server/http` with headers:
  - `Authorization: Bearer $MCP_SUPERGATEWAY_TOKEN`
  - `Accept: application/json, text/event-stream`
- Available tools: `execute_workflow`, `get_workflow_details`, `search_workflows`.
- Trigger Git Sync via:
  ```shell
  curl -sS -X POST https://8n8.oremuslabs.app/mcp-server/http \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${MCP_SUPERGATEWAY_TOKEN}" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"execute_workflow","arguments":{"workflowId":"QNoVZU40nl4mmTEN","inputs":{"type":"webhook","webhookData":{"method":"POST"}}}}}'
  ```
- Run the exporter via MCP by swapping in `WCmzFI4sbs3AbgEF` and the `n8n-to-repo-mcp` webhook path:
  ```shell
  curl -sS -X POST https://8n8.oremuslabs.app/mcp-server/http \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${MCP_SUPERGATEWAY_TOKEN}" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"execute_workflow","arguments":{"workflowId":"WCmzFI4sbs3AbgEF","inputs":{"type":"webhook","webhookData":{"method":"POST"}}}}}'
  ```

### Constraints & Notes
- GitHub token (`GITHUB_TOKEN`) and n8n API key must be present in the environment for HTTP nodes.
- `MCP_SUPERGATEWAY_TOKEN` stores the Bearer token used by `supergateway`/curl. The current value lives inline in `.codex/config.toml` under `[mcp_servers.n8n_mcp]` (see the `Authorization: Bearer …` header). Copy that string into your shell session with `export MCP_SUPERGATEWAY_TOKEN=<same value>` before running any MCP curl commands.
- n8n workflows exporting themselves must remove read-only fields (`active`, `tags`, runtime data) before hitting the git filesystem.
- Use slugified workflow names to avoid path clashes; when manual folder overrides are needed, store metadata inside the workflow (e.g., via `Set` node).
- Avoid recursive sync: never let Git Sync import n8n-to-Repo JSON or vice versa unless explicitly intended.
- MCP execution requires `availableInMCP: true` and active workflows; remember to toggle back on after re-imports.
- Extra exporter controls:
  - `Filter Workflows` honors `N8N_EXPORT_TAG` (set to `sync-to-git`, `ai`, etc.) so only tagged workflows export; set it to `*` or leave blank to export everything except helper-tagged items.
  - `N8N_EXPORT_ALLOWLIST` can contain a comma-separated list of workflow IDs or names for a hard allowlist (useful during phased rollouts).
  - Set `gitSyncPath` inside `workflow.settings` (e.g., `"gitSyncPath": "workflows/git-sync"`) when a workflow must write to a custom folder instead of the slugified default.

### End-to-End Verification Checklist (Mandatory)
1. **Repo ➜ n8n:** run Git Sync via MCP, confirm the target workflow updates (check execution log for `Update Workflow (PUT)` results and validate the workflow list in n8n).
2. **n8n ➜ Repo:** create or edit a workflow in n8n, run n8n-to-Repo Sync (UI or MCP), verify new/updated `workflows/**/workflow.json` files, and ensure git diff looks correct.
3. **Round Trip:** commit + push the exported files and re-run Git Sync, ensuring the workflow in n8n matches the committed JSON.
4. **MCP Health:** trigger both workflows via MCP webhooks to ensure remote automation functions (watch SSE output for completion).

All future changes to either workflow must include this verification loop so we never regress the bi-directional sync guarantees.
