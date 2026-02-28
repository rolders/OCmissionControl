#!/usr/bin/env bash
set -euo pipefail

LOCK=/tmp/mission-control-notify-harold-assignments.lock

# Prevent overlaps if a run ever takes >5 minutes
exec 9>"$LOCK"
if ! flock -n 9; then
  exit 0
fi

OUT=$(/root/clawd/mission-control/scripts/notify-harold-assignments.sh || true)

# Trim whitespace
TRIMMED=$(printf "%s" "$OUT" | sed -e 's/^[[:space:]]\+//' -e 's/[[:space:]]\+$//')

if [[ -z "$TRIMMED" ]]; then
  exit 0
fi

# Plain text Telegram message to Harold
openclaw message send --channel telegram --target 8082562348 --message "$OUT" --json >/dev/null
