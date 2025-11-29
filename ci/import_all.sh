#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "[import_all] jq is required. Install jq and retry." >&2
  exit 1
fi

: "${N8N_API_URL:?Set N8N_API_URL to the base URL of the target n8n instance (e.g. https://n8n.staging.example.com)}"
: "${N8N_API_KEY:?Set N8N_API_KEY to a personal API token for the target n8n instance}"

SEARCH_DIR=${1:-workflows}
if [[ ! -d "$SEARCH_DIR" ]]; then
  echo "[import_all] Directory '$SEARCH_DIR' not found" >&2
  exit 1
fi

shopt -s globstar nullglob
files=("$SEARCH_DIR"/**/workflow.json)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "[import_all] No workflow.json files found under '$SEARCH_DIR'"
  exit 0
fi

failures=0
for file in "${files[@]}"; do
  name=$(jq -r '.name // "(unnamed workflow)"' "$file")
  id=$(jq -r '.id // empty' "$file")
  if [[ -n "$id" ]]; then
    method="PUT"
    endpoint="$N8N_API_URL/rest/workflows/$id"
  else
    method="POST"
    endpoint="$N8N_API_URL/rest/workflows"
  fi
  echo "[import_all] $method $endpoint ($name)"
  if ! curl -fsS -X "$method" "$endpoint" \
      -H "Authorization: Bearer $N8N_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @"$file" > /dev/null; then
    echo "[import_all] Failed to import $file" >&2
    failures=$((failures + 1))
  fi
  sleep 0.2
done

if [[ $failures -gt 0 ]]; then
  echo "[import_all] Completed with $failures failure(s)" >&2
  exit 1
fi

echo "[import_all] Successfully imported ${#files[@]} workflow(s)"
