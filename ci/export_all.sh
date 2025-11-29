#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "[export_all] jq is required. Install jq and retry." >&2
  exit 1
fi

: "${N8N_API_URL:?Set N8N_API_URL to the base URL of the target n8n instance (e.g. https://n8n.dev.example.com)}"
: "${N8N_API_KEY:?Set N8N_API_KEY to a personal API token for the target n8n instance}"

OUTPUT_DIR=${1:-workflows}
mkdir -p "$OUTPUT_DIR"

slugify() {
  local text="$1"
  local slug
  slug=$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
  if [[ -z "$slug" ]]; then
    slug="workflow"
  fi
  printf '%s' "$slug"
}

echo "[export_all] Fetching workflows from $N8N_API_URL ..."
response=$(curl -fsS -H "Authorization: Bearer $N8N_API_KEY" "$N8N_API_URL/rest/workflows")
count=$(printf '%s' "$response" | jq '.count // 0')
echo "[export_all] Found $count workflows"

printf '%s' "$response" | jq -c '.data[]' | while IFS= read -r wf; do
  id=$(printf '%s' "$wf" | jq -r '.id')
  name=$(printf '%s' "$wf" | jq -r '.name')
  slug=$(slugify "$name")
  dir="$OUTPUT_DIR/$slug"
  if [[ -d "$dir" && ! -f "$dir/workflow.json" ]]; then
    : # reuse existing dir
  elif [[ -d "$dir" && -f "$dir/workflow.json" ]]; then
    existing_id=$(jq -r '.id // ""' "$dir/workflow.json" 2>/dev/null || true)
    if [[ "$existing_id" != "$id" ]]; then
      dir="$OUTPUT_DIR/${slug}-${id}"
    fi
  fi
  mkdir -p "$dir"
  echo "[export_all] Exporting #$id ($name) -> $dir/workflow.json"
  curl -fsS -H "Authorization: Bearer $N8N_API_KEY" "$N8N_API_URL/rest/workflows/$id" \
    | jq '.data' > "$dir/workflow.json"
  printf '{\n  "exportedAt": "%s",\n  "source": "%s"\n}\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$N8N_API_URL" \
    > "$dir/.workflow-metadata.json"
done

echo "[export_all] Complete"
