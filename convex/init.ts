import { mutation } from "./_generated/server";

// Seed initial agents and a welcome activity.
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Ensure default project exists.
    const existingDefault = await ctx.db
      .query("projects")
      .withIndex("by_slug", (ix) => ix.eq("slug", "default"))
      .unique();
    if (!existingDefault) {
      await ctx.db.insert("projects", {
        name: "Default",
        slug: "default",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Idempotent-ish: rely on agents.upsert.
    // We call internal logic here to avoid circular imports.
    const existing = await ctx.db.query("agents").collect();
    if (existing.length === 0) {
      const marcusId = await ctx.db.insert("agents", {
        name: "Marcus",
        role: "Squad Lead",
        status: "idle",
        sessionKey: "agent:main:main",
        currentTaskId: undefined,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("agents", {
        name: "Epictetus",
        role: "Developer",
        status: "idle",
        sessionKey: "agent:epictetus:main",
        currentTaskId: undefined,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("agents", {
        name: "Seneca",
        role: "Researcher / Content",
        status: "idle",
        sessionKey: "agent:seneca:main",
        currentTaskId: undefined,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("activities", {
        type: "seed",
        agentId: marcusId,
        taskId: undefined,
        message: "Mission Control initialized.",
        createdAt: now,
      });

      return { ok: true, seeded: true };
    }

    return { ok: true, seeded: false, agents: existing.length };
  },
});
