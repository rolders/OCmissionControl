#!/usr/bin/env bash
set -euo pipefail

# Mission Control heartbeat helper.
# Prints JSON from Convex heartbeat.check for a given OpenClaw sessionKey.

SESSION_KEY="${1:-}"
if [[ -z "$SESSION_KEY" ]]; then
  echo "usage: heartbeat.sh <sessionKey>" >&2
  exit 2
fi

cd /root/clawd/mission-control

# Load Convex deployment/env if present (so this script works non-interactively)
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

npx --yes convex run api.heartbeat.check "{\"sessionKey\":\"${SESSION_KEY}\",\"limit\":10}"
