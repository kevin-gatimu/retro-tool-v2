#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
SERVICE_NAME="convex-backend"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --service)
      SERVICE_NAME="${2:-}"
      if [[ -z "$SERVICE_NAME" ]]; then
        echo "--service requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--dry-run] [--service convex-backend]" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker/docker-compose.local.yml"
COMPOSE_ENV="$REPO_ROOT/docker/.env"

set_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$file" ]]; then
    echo "Skipping missing file: $file"
    return
  fi

  if $DRY_RUN; then
    echo "[dry-run] Would set $key in $file"
    return
  fi

  local tmp
  tmp="$(mktemp)"

  if grep -qE "^${key}=" "$file"; then
    awk -v k="$key" -v v="$value" '
      $0 ~ "^" k "=" { $0 = k "=" v }
      { print }
    ' "$file" > "$tmp"
  else
    cat "$file" > "$tmp"
    printf "\n%s=%s\n" "$key" "$value" >> "$tmp"
  fi

  mv "$tmp" "$file"
  echo "Updated $key in $file"
}

generate_key() {
  echo "Generating admin key via docker compose service '$SERVICE_NAME'..." >&2

  local out key
  if out="$(docker compose --env-file "$COMPOSE_ENV" -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" ./generate_admin_key.sh 2>/dev/null || true)"; then
    key="$(printf "%s\n" "$out" | grep -Eo 'convex-[^|[:space:]]+\|[A-Za-z0-9]+' | tail -n 1 || true)"
    if [[ -n "$key" ]]; then
      printf "%s\n" "$key"
      return 0
    fi
  fi

  echo "Compose exec did not return a key, trying docker exec fallback..." >&2
  local container_id
  container_id="$(docker ps --filter "name=$SERVICE_NAME" --format '{{.ID}}' | head -n 1)"
  if [[ -z "$container_id" ]]; then
    echo "Could not find a running container matching '$SERVICE_NAME'. Start local infra first (pnpm local:infra)." >&2
    return 1
  fi

  out="$(docker exec "$container_id" ./generate_admin_key.sh)"
  key="$(printf "%s\n" "$out" | grep -Eo 'convex-[^|[:space:]]+\|[A-Za-z0-9]+' | tail -n 1 || true)"

  if [[ -z "$key" ]]; then
    echo "Failed to parse CONVEX_SELF_HOSTED_ADMIN_KEY from container output." >&2
    return 1
  fi

  printf "%s\n" "$key"
}

KEY="$(generate_key)"

echo
echo "New CONVEX_SELF_HOSTED_ADMIN_KEY:"
echo "$KEY"
echo

set_env_var "$REPO_ROOT/convex-backend/.env" "CONVEX_SELF_HOSTED_ADMIN_KEY" "$KEY"
set_env_var "$REPO_ROOT/docker/.env" "CONVEX_SELF_HOSTED_ADMIN_KEY" "$KEY"
set_env_var "$REPO_ROOT/docker/.env" "CONVEX_SYNC_ADMIN_KEY" "$KEY"
set_env_var "$REPO_ROOT/retro-tool-api/.env" "CONVEX_SYNC_ADMIN_KEY" "$KEY"

if $DRY_RUN; then
  echo
  echo "Dry run complete. No files were changed."
else
  echo
  echo "Done. Restart API and Convex tooling to pick up the refreshed key."
fi
