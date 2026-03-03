import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseDueDateMs(dueDate: string): number | null {
  // dueDate is stored as YYYY-MM-DD. Interpret it as midnight *local* time.
  // (This matches the UI semantics and avoids TZ ambiguity in storage.)
  const parsed = new Date(`${dueDate}T00:00:00`);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export const getTasksNeedingAttention = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const todayMs = startOfTodayMs();
    const soonMs = todayMs + 7 * 24 * 60 * 60 * 1000;

    const all = await ctx.db.query("tasks").collect();
    const out: Array<{
      id: string;
      title: string;
      status: string;
      dueDate?: string;
      etaAt?: number;
      overdue: boolean;
      dueSoon: boolean;
      kind: "dueDate" | "etaAt" | "either";
      targetAt: number;
    }> = [];

    for (const t of all) {
      if (t.status === "done") continue;

      const dueDate = (t as any).dueDate as string | undefined;
      const etaAt = (t as any).etaAt as number | undefined;
      if (!dueDate && !etaAt) continue;

      const dueMs = dueDate ? parseDueDateMs(dueDate) : null;
      const etaMs = typeof etaAt === "number" ? etaAt : null;

      const candidates: Array<{ kind: "dueDate" | "etaAt"; at: number }> = [];
      if (dueMs != null) candidates.push({ kind: "dueDate", at: dueMs });
      if (etaMs != null) candidates.push({ kind: "etaAt", at: etaMs });
      if (candidates.length === 0) continue;

      // If both exist, pick the earlier one for attention purposes.
      candidates.sort((a, b) => a.at - b.at);
      const chosen = candidates[0];

      const overdue = chosen.at < todayMs;
      const dueSoon = !overdue && chosen.at <= soonMs;
      if (!overdue && !dueSoon) continue;

      const kind: "dueDate" | "etaAt" | "either" =
        candidates.length > 1 ? "either" : chosen.kind;

      out.push({
        id: t._id,
        title: t.title,
        status: t.status,
        dueDate,
        etaAt,
        overdue,
        dueSoon,
        kind,
        targetAt: chosen.at,
      });
    }

    out.sort((a, b) => a.targetAt - b.targetAt);
    return out.slice(0, limit);
  },
});

export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    const todayMs = startOfTodayMs();
    const soonMs = todayMs + 7 * 24 * 60 * 60 * 1000;

    const all = await ctx.db.query("tasks").collect();

    const summary: {
      overdue: number;
      dueSoon: number;
      noTarget: number;
      byStatus: Record<string, { overdue: number; dueSoon: number; total: number }>;
    } = {
      overdue: 0,
      dueSoon: 0,
      noTarget: 0,
      byStatus: {},
    };

    for (const t of all) {
      if (t.status === "done") continue;
      const status = t.status;
      summary.byStatus[status] ??= { overdue: 0, dueSoon: 0, total: 0 };
      summary.byStatus[status].total++;

      const dueDate = (t as any).dueDate as string | undefined;
      const etaAt = (t as any).etaAt as number | undefined;

      const dueMs = dueDate ? parseDueDateMs(dueDate) : null;
      const etaMs = typeof etaAt === "number" ? etaAt : null;

      const targets: number[] = [];
      if (dueMs != null) targets.push(dueMs);
      if (etaMs != null) targets.push(etaMs);

      if (targets.length === 0) {
        summary.noTarget++;
        continue;
      }

      const targetAt = Math.min(...targets);
      const overdue = targetAt < todayMs;
      const dueSoon = !overdue && targetAt <= soonMs;

      if (overdue) {
        summary.overdue++;
        summary.byStatus[status].overdue++;
      } else if (dueSoon) {
        summary.dueSoon++;
        summary.byStatus[status].dueSoon++;
      }
    }

    return summary;
  },
});

export const recordCheck = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("activities", {
      type: "triage_check",
      agentId: undefined,
      taskId: undefined,
      message: `Triage check recorded at ${new Date(now).toISOString()}`,
      createdAt: now,
    });
    return { ok: true, checkedAt: now };
  },
});
