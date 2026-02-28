import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    return task;
  },
});
