#!/usr/bin/env bash
set -euo pipefail

# Daily standup summary for Mission Control (Epictetus + Seneca)
# Outputs plain text suitable for a Telegram message.

cd /root/clawd/mission-control

fetch() {
  local sessionKey="$1"
  npx --yes convex run api.heartbeat.check "{\"sessionKey\":\"${sessionKey}\",\"limit\":5}" --quiet 2>/dev/null || \
  npx --yes convex run api.heartbeat.check "{\"sessionKey\":\"${sessionKey}\",\"limit\":5}"
}

EP_JSON="$(fetch agent:epictetus:main)"
SE_JSON="$(fetch agent:seneca:main)"

node - <<'NODE'
function fmtCounts(counts) {
  if (!counts || Object.keys(counts).length === 0) return "0";
  const order = ["assigned","in_progress","review","blocked","inbox","done"];
  const parts = [];
  for (const k of order) if (counts[k]) parts.push(`${k}:${counts[k]}`);
  for (const k of Object.keys(counts)) if (!order.includes(k) && counts[k]) parts.push(`${k}:${counts[k]}`);
  return parts.join(" ");
}

function topTasks(tasks) {
  if (!tasks || tasks.length === 0) return "(none)";
  return tasks.slice(0,3).map(t => `- ${t.title} (${t.status})`).join("\n");
}

const ep = JSON.parse(process.env.EP_JSON);
const se = JSON.parse(process.env.SE_JSON);

const now = new Date();
const header = `DAILY STANDUP — ${now.toISOString().slice(0,10)}`;

function section(label, data) {
  if (!data.ok) return `${label}: ERROR ${data.error || "unknown"}`;
  const name = data.agent?.name || label;
  const counts = fmtCounts(data.counts);
  const tasks = topTasks((data.tasks || []).filter(t => t.status !== "done"));
  return `${name}: ${counts}\n${tasks}`;
}

console.log([header, "", section("Epictetus", ep), "", section("Seneca", se)].join("\n"));
NODE
