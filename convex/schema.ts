import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Mission Control schema (based on the article)
// Keep it simple first; we can evolve types as UI/workflows mature.
export default defineSchema({
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    // idle|active|blocked (string union; keep flexible)
    status: v.string(),
    // OpenClaw session key, e.g. agent:epictetus:main
    sessionKey: v.string(),
    currentTaskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionKey", ["sessionKey"])
    .index("by_name", ["name"]),

  projects: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    driveUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    // inbox|assigned|in_progress|review|done|blocked
    status: v.string(),
    assigneeIds: v.array(v.id("agents")),
    tags: v.optional(v.array(v.string())),
    priority: v.optional(v.string()),

    // Target completion date (YYYY-MM-DD). Kept as a date-only string to avoid TZ ambiguity.
    dueDate: v.optional(v.string()),

    // ETA / target completion timestamp (ms since epoch). Used for "overdue/soon" monitoring.
    etaAt: v.optional(v.number()),

    // Project context. New code should use projectId.
    projectId: v.optional(v.id("projects")),
    // Legacy string label (kept for backward compatibility + migration).
    project: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_projectId", ["projectId"])
    .index("by_projectId_status", ["projectId", "status"]),

  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    // Backwards-compatible: content is plain text.
    content: v.string(),
    // Preferred: HTML-formatted content (sanitized in UI before rendering).
    contentHtml: v.optional(v.string()),
    attachments: v.optional(v.array(v.id("documents"))),
    createdAt: v.number(),
  }).index("by_taskId", ["taskId"]),

  activities: defineTable({
    type: v.string(),
    agentId: v.optional(v.id("agents")),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_taskId", ["taskId"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.string(),
    taskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_taskId", ["taskId"]),

  notifications: defineTable({
    mentionedAgentId: v.id("agents"),
    content: v.string(),
    delivered: v.boolean(),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_delivered", ["delivered"])
    .index("by_agentId_delivered", ["mentionedAgentId", "delivered"]),
});
