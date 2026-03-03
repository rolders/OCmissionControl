#!/usr/bin/env bash
set -euo pipefail

# Plain-text triage summary (due date / ETA soon/overdue)
# Intended for cron use.

cd /root/clawd/mission-control

SUMMARY_JSON=$(npx --yes convex run api.triage.getSummary '{}' --quiet 2>/dev/null || \
  npx --yes convex run api.triage.getSummary '{}')
ATTN_JSON=$(npx --yes convex run api.triage.getTasksNeedingAttention '{"limit":5}' --quiet 2>/dev/null || \
  npx --yes convex run api.triage.getTasksNeedingAttention '{"limit":5}')

SUMMARY_JSON="$SUMMARY_JSON" ATTN_JSON="$ATTN_JSON" node - <<'NODE'
const summary = JSON.parse(process.env.SUMMARY_JSON);
const attn = JSON.parse(process.env.ATTN_JSON);

const parts = [];
parts.push(`Mission Control triage: overdue=${summary.overdue} dueSoon=${summary.dueSoon} noTarget=${summary.noTarget}`);

if (Array.isArray(attn) && attn.length) {
  parts.push("\nTop attention:");
  for (const t of attn) {
    const tag = t.overdue ? "OVERDUE" : (t.dueSoon ? "SOON" : "");
    const when = t.dueDate ? `due ${t.dueDate}` : (t.etaAt ? `eta ${new Date(t.etaAt).toISOString().slice(0,10)}` : "");
    parts.push(`- ${t.title} [${t.status}] ${when} ${tag}`.trim());
  }
}

console.log(parts.join("\n"));
NODE
