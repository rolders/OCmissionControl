#!/usr/bin/env bash
set -euo pipefail

# List Mission Control inbox tasks (JSON)
cd /root/clawd/mission-control
npx --yes convex run api.tasks.listByStatus '{"status":"inbox"}'
