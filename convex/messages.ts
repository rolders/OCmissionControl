import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();

    // Enrich with commenter name.
    const agentIds = Array.from(new Set(msgs.map((m) => m.fromAgentId)));
    const agents = await Promise.all(agentIds.map((id) => ctx.db.get(id)));
    const nameById: Record<string, string> = {};
    for (const a of agents) {
      if (a) nameById[a._id] = a.name;
    }

    return msgs.map((m) => ({
      ...m,
      fromAgentName: nameById[m.fromAgentId] ?? "(unknown)",
    }));
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    content: v.string(),
    contentHtml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      taskId: args.taskId,
      fromAgentId: args.fromAgentId,
      content: args.content,
      contentHtml: args.contentHtml,
      attachments: [],
      createdAt: now,
    });

    await ctx.db.insert("activities", {
      type: "message_sent",
      agentId: args.fromAgentId,
      taskId: args.taskId,
      message: args.content.slice(0, 160),
      createdAt: now,
    });

    return id;
  },
});
