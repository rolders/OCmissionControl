#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
STATUS="${2:-}"
if [[ -z "$TASK_ID" || -z "$STATUS" ]]; then
  echo "usage: task-move.sh <taskId> <status>" >&2
  exit 2
fi

cd /root/clawd/mission-control
npx --yes convex run api.tasks.updateStatus "{\"id\":\"${TASK_ID}\",\"status\":\"${STATUS}\"}"
