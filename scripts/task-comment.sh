#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
FROM_AGENT_ID="${2:-}"
shift 2 || true
CONTENT="${*:-}"

if [[ -z "$TASK_ID" || -z "$FROM_AGENT_ID" || -z "$CONTENT" ]]; then
  echo "usage: task-comment.sh <taskId> <fromAgentId> <content...>" >&2
  exit 2
fi

cd /root/clawd/mission-control
# JSON escape via node
node - <<'NODE'
const fs = require('fs');
const taskId = process.env.TASK_ID;
const fromAgentId = process.env.FROM_AGENT_ID;
const content = process.env.CONTENT;
const payload = JSON.stringify({ taskId, fromAgentId, content });
process.stdout.write(payload);
NODE
