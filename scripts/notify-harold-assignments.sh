#!/usr/bin/env bash
set -euo pipefail

# Emits a message to stdout only when NEW task assignments to Harold are detected.
# Intended to be run by an OpenClaw cron agentTurn that will send stdout to Telegram.

ROOT="/root/clawd"
MC="/root/clawd/mission-control"
STATE_FILE="$ROOT/memory/mission-control-harold-assignments.json"

HAROLD_AGENT_ID="j970egrnqwm4gf69c9em7mzxms80jh74"

cd "$MC"

# Fetch assigned tasks (scan is fine for small dataset)
TASKS_JSON=$(npx --yes convex run api.haroldNotify.listTasksForAssignee '{"assigneeId":"'$HAROLD_AGENT_ID'","statuses":["inbox","assigned","in_progress","review","blocked"]}')

# TASKS_JSON is JSON array.
STATE_FILE="$STATE_FILE" TASKS_JSON="$TASKS_JSON" python3 - <<'PY'
import json, os, sys, time
state_file=os.environ["STATE_FILE"]
tasks=json.loads(os.environ["TASKS_JSON"])

prev=set()
if os.path.exists(state_file):
    try:
        prev=set(json.load(open(state_file)).get('taskIds', []))
    except Exception:
        prev=set()

cur=[t['_id'] for t in tasks]
cur_set=set(cur)
new=[t for t in tasks if t['_id'] not in prev]

# Persist current set
os.makedirs(os.path.dirname(state_file), exist_ok=True)
json.dump({'taskIds':cur, 'updatedAt':int(time.time()*1000)}, open(state_file,'w'))

if not new:
    sys.exit(0)

lines=["Mission Control: task(s) assigned to you:"]
for t in sorted(new, key=lambda x: x.get('updatedAt',0), reverse=True):
    lines.append(f"- {t.get('title','(untitled)')}  [{t.get('status','')}]  (id {t['_id']})")
lines.append("\nOpen: http://100.67.12.1:8080/")
print("\n".join(lines))
PY