import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByStatus = query({
  args: {
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    // Prefer indexed filtering where possible.
    if (args.projectId && args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_projectId_status", (ix) =>
          ix.eq("projectId", args.projectId).eq("status", args.status as string),
        )
        .order("desc")
        .collect();
    }

    if (args.projectId && !args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_projectId", (ix) => ix.eq("projectId", args.projectId))
        .order("desc")
        .collect();
    }

    if (!args.projectId && args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_status", (ix) => ix.eq("status", args.status as string))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("tasks").order("desc").collect();
  },
});

// Legacy helper: returns a sorted list of project names.
// Prefer api.projects.list instead.
export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    return projects
      .map((p) => p.name)
      .filter((n) => n.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    assigneeIds: v.optional(v.array(v.id("agents"))),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    // legacy
    project: v.optional(v.string()),

    // Target completion date (YYYY-MM-DD)
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status ?? "inbox",
      assigneeIds: args.assigneeIds ?? [],
      tags: args.tags,
      priority: args.priority,
      projectId: args.projectId,
      project: args.project,
      dueDate: args.dueDate,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: undefined,
      taskId: id,
      message: `Task created: ${args.title}`,
      createdAt: now,
    });

    return id;
  },
});

export const updateStatus = mutation({
  args: { id: v.id("tasks"), status: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { status: args.status, updatedAt: now });
    await ctx.db.insert("activities", {
      type: "task_status_changed",
      agentId: undefined,
      taskId: args.id,
      message: `Task status changed to: ${args.status}`,
      createdAt: now,
    });
  },
});

export const setAssignees = mutation({
  args: { id: v.id("tasks"), assigneeIds: v.array(v.id("agents")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { assigneeIds: args.assigneeIds, updatedAt: now });
    await ctx.db.insert("activities", {
      type: "task_assignees_changed",
      agentId: undefined,
      taskId: args.id,
      message: `Task assignees updated (${args.assigneeIds.length})`,
      createdAt: now,
    });
  },
});

// Hard delete (MVP). Removes the task plus related messages/activities/documents.
// (We can evolve this into Archive/Trash later.)
export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return { ok: true, deleted: false };

    // Log deletion before deleting
    await ctx.db.insert("activities", {
      type: "task_deleted",
      agentId: undefined,
      taskId: args.id,
      message: `Task deleted: ${task.title}`,
      createdAt: Date.now(),
    });

    // Delete messages
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.id))
      .collect();
    for (const m of msgs) {
      await ctx.db.delete(m._id);
    }

    // Delete activities (excluding the one we just inserted)
    const acts = await ctx.db
      .query("activities")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.id))
      .collect();
    for (const a of acts) {
      await ctx.db.delete(a._id);
    }

    // Delete documents tied to this task
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.id))
      .collect();
    for (const d of docs) {
      await ctx.db.delete(d._id);
    }

    await ctx.db.delete(args.id);

    return { ok: true, deleted: true };
  },
});

export const setProject = mutation({
  args: { id: v.id("tasks"), project: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { project: args.project, updatedAt: now });
    await ctx.db.insert("activities", {
      type: "task_project_changed",
      agentId: undefined,
      taskId: args.id,
      message: args.project
        ? `Task project set to: ${args.project}`
        : "Task project cleared",
      createdAt: now,
    });
  },
});

export const setProjectId = mutation({
  args: { id: v.id("tasks"), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { projectId: args.projectId, updatedAt: now });
    await ctx.db.insert("activities", {
      type: "task_project_changed",
      agentId: undefined,
      taskId: args.id,
      message: args.projectId ? "Task project updated" : "Task project cleared",
      createdAt: now,
    });
  },
});

export const setDueDate = mutation({
  args: { id: v.id("tasks"), dueDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { dueDate: args.dueDate, updatedAt: now });
    await ctx.db.insert("activities", {
      type: "task_due_date_changed",
      agentId: undefined,
      taskId: args.id,
      message: args.dueDate ? `Task due date set: ${args.dueDate}` : "Task due date cleared",
      createdAt: now,
    });
  },
});

