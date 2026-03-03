import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {
    sessionKey: v.string(),
    includeDone: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .unique();

    if (!agent) {
      return { ok: false, error: `No agent found for sessionKey=${args.sessionKey}` };
    }

    const includeDone = args.includeDone ?? false;
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    // MVP: scan tasks and filter by assignee. (Fine for small scale.)
    const all = await ctx.db.query("tasks").collect();
    const tasks = all
      .filter((t) => t.assigneeIds.includes(agent._id))
      .filter((t) => includeDone || t.status !== "done")
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, limit)
      .map((t) => ({
        id: t._id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
        dueDate: (t as any).dueDate,
        etaAt: (t as any).etaAt,
      }));

    const counts: Record<string, number> = {};
    for (const t of all) {
      if (!t.assigneeIds.includes(agent._id)) continue;
      if (!includeDone && t.status === "done") continue;
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }

    return {
      ok: true,
      agent: {
        id: agent._id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        sessionKey: agent.sessionKey,
      },
      counts,
      tasks,
    };
  },
});
