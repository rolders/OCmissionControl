#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "usage: task-get.sh <taskId>" >&2
  exit 2
fi

cd /root/clawd/mission-control
npx --yes convex run api.taskDetail.get "{\"id\":\"${TASK_ID}\"}"
