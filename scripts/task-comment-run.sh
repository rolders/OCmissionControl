#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
FROM_AGENT_ID="${2:-}"
shift 2 || true
CONTENT="${*:-}"

if [[ -z "$TASK_ID" || -z "$FROM_AGENT_ID" || -z "$CONTENT" ]]; then
  echo "usage: task-comment-run.sh <taskId> <fromAgentId> <content...>" >&2
  exit 2
fi

cd /root/clawd/mission-control
PAYLOAD=$(TASK_ID="$TASK_ID" FROM_AGENT_ID="$FROM_AGENT_ID" CONTENT="$CONTENT" /root/clawd/mission-control/scripts/task-comment.sh "$TASK_ID" "$FROM_AGENT_ID" "$CONTENT")

npx --yes convex run api.messages.create "$PAYLOAD"
