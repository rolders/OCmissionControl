#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   notify-if-changed.sh <key> <text>
# If <text> differs from last stored value for <key>, prints the text and exits 0.
# If unchanged, exits 3.
#
# Storage: /root/clawd/memory/mission-control-notify-state.json

KEY="${1:-}"
shift || true
TEXT="${*:-}"

if [[ -z "$KEY" ]]; then
  echo "usage: notify-if-changed.sh <key> <text>" >&2
  exit 2
fi

STATE_FILE="/root/clawd/memory/mission-control-notify-state.json"
mkdir -p "$(dirname "$STATE_FILE")"

# Ensure file exists
if [[ ! -f "$STATE_FILE" ]]; then
  echo '{}' > "$STATE_FILE"
fi

LAST="$(jq -r --arg k "$KEY" '.[$k] // ""' "$STATE_FILE" 2>/dev/null || echo "")"

if [[ "$TEXT" == "$LAST" ]]; then
  # No change; succeed silently so cron runs don't look like failures.
  exit 0
fi

TMP=$(mktemp)
jq --arg k "$KEY" --arg v "$TEXT" '.[$k]=$v' "$STATE_FILE" > "$TMP"
mv "$TMP" "$STATE_FILE"

printf "%s" "$TEXT"
