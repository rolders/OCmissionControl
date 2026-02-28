import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function ensureDefaultProject(ctx: any) {
  const existing = await ctx.db
    .query("projects")
    .withIndex("by_slug", (ix: any) => ix.eq("slug", "default"))
    .unique();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("projects", {
    name: "Default",
    slug: "default",
    createdAt: now,
    updatedAt: now,
  });
  return await ctx.db.get(id);
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").order("asc").collect();
    return projects;
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query MUST be read-only. So getDefault only returns the Default project if it exists.
// Use ensureDefault (mutation) to create it.
export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_slug", (ix: any) => ix.eq("slug", "default"))
      .unique();
  },
});

// Ensure Default project exists (write operation).
export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const p = await ensureDefaultProject(ctx);
    return p;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const base = slugify(args.name);
    const slugBase = base.length ? base : "project";

    // Ensure unique slug
    let slug = slugBase;
    let i = 2;
    while (
      await ctx.db
        .query("projects")
        .withIndex("by_slug", (ix) => ix.eq("slug", slug))
        .unique()
    ) {
      slug = `${slugBase}-${i++}`;
    }

    const id = await ctx.db.insert("projects", {
      name: args.name.trim(),
      slug,
      description: args.description?.trim() || undefined,
      driveUrl: args.driveUrl?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      type: "project_created",
      agentId: undefined,
      taskId: undefined,
      message: `Project created: ${args.name.trim()}`,
      createdAt: now,
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: any = { updatedAt: now };

    if (typeof args.name === "string") {
      patch.name = args.name.trim();
      // keep slug stable for now (MVP)
    }
    if (typeof args.description === "string") {
      patch.description = args.description.trim() || undefined;
    }
    if (typeof args.driveUrl === "string") {
      patch.driveUrl = args.driveUrl.trim() || undefined;
    }

    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("activities", {
      type: "project_updated",
      agentId: undefined,
      taskId: undefined,
      message: `Project updated: ${args.id}`,
      createdAt: now,
    });

    return { ok: true };
  },
});

// Backfill: ensure every task has a projectId.
// - If task already has projectId: leave it.
// - If task has legacy project string: map to a project with same slug.
// - Else: assign Default.
export const backfillTaskProjectIds = mutation({
  args: {},
  handler: async (ctx) => {
    const defaultProject = await ensureDefaultProject(ctx);
    if (!defaultProject) throw new Error("Failed to ensure default project");

    const tasks = await ctx.db.query("tasks").collect();
    let updated = 0;

    for (const t of tasks) {
      if (t.projectId) continue;

      let projectId = defaultProject._id;

      const legacy = typeof t.project === "string" ? t.project.trim() : "";
      if (legacy) {
        const slug = slugify(legacy) || "project";
        let p = await ctx.db
          .query("projects")
          .withIndex("by_slug", (ix) => ix.eq("slug", slug))
          .unique();
        if (!p) {
          const now = Date.now();
          const id = await ctx.db.insert("projects", {
            name: legacy,
            slug,
            createdAt: now,
            updatedAt: now,
          });
          p = await ctx.db.get(id);
        }
        if (p) projectId = p._id;
      }

      await ctx.db.patch(t._id, { projectId, updatedAt: Date.now() });
      updated++;
    }

    return { ok: true, updated };
  },
});
