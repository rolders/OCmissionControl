import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").order("desc").collect();
  },
});

export const upsert = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    status: v.optional(v.string()),
    sessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        status: args.status ?? existing.status,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("agents", {
      name: args.name,
      role: args.role,
      status: args.status ?? "idle",
      sessionKey: args.sessionKey,
      currentTaskId: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});
