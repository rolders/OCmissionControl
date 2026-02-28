import { query } from "./_generated/server";
import { v } from "convex/values";

// Lightweight query for the notification cron: returns tasks assigned to a given agent.
// Note: this scans tasks (fine for our small dataset). If it grows, add an index table.
export const listTasksForAssignee = query({
  args: {
    assigneeId: v.id("agents"),
    // Optional: filter to these statuses only.
    statuses: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("tasks").order("desc").collect();
    const statuses = args.statuses;
    return all
      .filter((t) => (t.assigneeIds ?? []).includes(args.assigneeId))
      .filter((t) => (!statuses ? true : statuses.includes(t.status)))
      .map((t) => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
        projectId: (t as any).projectId,
      }));
  },
});
