import { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import sanitizeHtml from "sanitize-html";
import { api } from "../convex/_generated/api";

const PROJECT_FILTER_STORAGE_KEY = "missionControl_projectFilter";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function CommentBody({
  content,
  contentHtml,
}: {
  content: string;
  contentHtml?: string;
}) {
  const html = useMemo(() => {
    const trimmedHtml = contentHtml?.trim();

    // Back-compat: some older comments were posted with HTML inside `content`.
    const looksLikeHtml =
      !trimmedHtml && /<\/?(p|br|ul|ol|li|strong|em|code|pre|a|blockquote)\b/i.test(content);

    const candidateHtml = trimmedHtml && trimmedHtml.length ? trimmedHtml : looksLikeHtml ? content : null;

    if (candidateHtml) {
      return sanitizeHtml(candidateHtml, {
        allowedTags: [
          "p",
          "br",
          "strong",
          "b",
          "em",
          "i",
          "u",
          "code",
          "pre",
          "ul",
          "ol",
          "li",
          "a",
          "blockquote",
        ],
        allowedAttributes: {
          a: ["href", "target", "rel"],
        },
        transformTags: {
          a: sanitizeHtml.simpleTransform("a", {
            target: "_blank",
            rel: "noopener noreferrer",
          }),
        },
      });
    }

    // Plain text → safe HTML with line breaks.
    return escapeHtml(content).replaceAll("\n", "<br/>");
  }, [content, contentHtml]);

  return <div className="commentBody" dangerouslySetInnerHTML={{ __html: html }} />;
}

const STATUSES: Array<{ key: string; title: string }> = [
  { key: "inbox", title: "Inbox" },
  { key: "assigned", title: "Assigned" },
  { key: "in_progress", title: "In Progress" },
  { key: "review", title: "Review" },
  { key: "blocked", title: "Blocked" },
  { key: "done", title: "Done" },
];

function Column({
  status,
  title,
  projectIdFilter,
  projectNameById,
  onSelect,
}: {
  status: string;
  title: string;
  projectIdFilter: string | null;
  projectNameById: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  const tasks = useQuery(api.tasks.listByStatus, {
    status,
    projectId: projectIdFilter ?? undefined,
  });

  return (
    <div className="col">
      <div className="colHeader">
        <div className="colTitle">{title}</div>
        <div className="colCount">{tasks?.length ?? "–"}</div>
      </div>
      <div className="colBody">
        {(tasks ?? []).map((t) => (
          <button
            key={t._id}
            className="card cardButton"
            onClick={() => onSelect(t._id)}
          >
            <div className="cardTitle">{t.title}</div>
            {t.description ? <div className="cardDesc">{t.description}</div> : null}
            <div className="cardMeta">
              <span className="pill">{t.status}</span>
              {t.projectId ? (
                <span className="pill pillMuted">
                  {projectNameById[t.projectId] ?? "Project"}
                </span>
              ) : null}
              {t.tags?.slice(0, 3).map((tag) => (
                <span key={tag} className="pill pillMuted">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  onDelete,
}: {
  open: boolean;
  title: string;
  children: any;
  onClose: () => void;
  onDelete?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <div className="modalActions">
            {onDelete ? (
              <button className="btn btnDanger" onClick={onDelete}>
                Delete
              </button>
            ) : null}
            <button className="btn btnGhost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function isValidHttpUrl(s: string) {
  const v = s.trim();
  if (!v) return true;
  return v.startsWith("http://") || v.startsWith("https://");
}

function MissionQueuePage() {
  const agents = useQuery(api.agents.list, {});
  const activities = useQuery(api.activities.listRecent, { limit: 40 });

  const projects = useQuery(api.projects.list, {});
  const defaultProject = useQuery(api.projects.getDefault, {});
  const ensureDefaultProject = useMutation(api.projects.ensureDefault);

  const createProject = useMutation(api.projects.create);
  const backfillTaskProjectIds = useMutation(api.projects.backfillTaskProjectIds);

  const createTask = useMutation(api.tasks.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const setAssignees = useMutation(api.tasks.setAssignees);
  const setProjectId = useMutation(api.tasks.setProjectId);
  const setDueDate = useMutation(api.tasks.setDueDate);
  const deleteTask = useMutation(api.tasks.remove);
  const createMessage = useMutation(api.messages.create);

  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects ?? []) m[p._id] = p.name;
    return m;
  }, [projects]);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Board filtering - localStorage persistence
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const stored = localStorage.getItem(PROJECT_FILTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  // Save to localStorage when filter changes
  useEffect(() => {
    localStorage.setItem(PROJECT_FILTER_STORAGE_KEY, JSON.stringify(activeProjectId));
  }, [activeProjectId]);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  // Create project modal
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectDriveUrl, setNewProjectDriveUrl] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useQuery(
    api.taskDetail.get,
    selectedTaskId ? { id: selectedTaskId as any } : ("skip" as any),
  );

  const nonLeadAgents = useMemo(() => {
    // Allow assigning to Marcus/Epictetus/Seneca/Harold.
    return agents ?? [];
  }, [agents]);

  const selectedMessages = useQuery(
    api.messages.listForTask,
    selectedTaskId ? { taskId: selectedTaskId as any } : ("skip" as any),
  );

  const myAgent = useMemo(() => {
    // The human user (Harold) is the UI commenter by default.
    // Temporary stand-in until we add auth.
    return (
      (agents ?? []).find((a) => a.name === "Harold") ??
      (agents ?? []).find((a) => a.name === "Marcus") ??
      null
    );
  }, [agents]);

  const [comment, setComment] = useState("");

  async function onCreateTask() {
    const title = newTitle.trim();
    if (!title) return;

    // If we need a default project and it doesn't exist yet, create it.
    if (!activeProjectId && !defaultProject?._id) {
      await ensureDefaultProject({});
    }

    const projectId = activeProjectId ?? defaultProject?._id;

    const id = await createTask({
      title,
      description: newDesc.trim() || undefined,
      projectId: projectId as any,
      status: "inbox",
      assigneeIds: [],
    });
    setNewTitle("");
    setNewDesc("");
    setSelectedTaskId(id);
  }

  async function onMove(status: string) {
    if (!selectedTaskId) return;
    await updateStatus({ id: selectedTaskId as any, status });
  }

  async function toggleAssignee(agentId: string) {
    if (!selectedTaskId || !selectedTask) return;
    const current = (selectedTask.assigneeIds as string[]) ?? [];
    const next = current.includes(agentId)
      ? current.filter((x) => x !== agentId)
      : [...current, agentId];
    await setAssignees({ id: selectedTaskId as any, assigneeIds: next as any });
  }

  async function onAddComment() {
    if (!selectedTaskId || !myAgent) return;
    const text = comment.trim();
    if (!text) return;
    // For manual comments, store as plain text; rendering will format line breaks.
    await createMessage({
      taskId: selectedTaskId as any,
      fromAgentId: myAgent._id as any,
      content: text,
    });
    setComment("");
  }

  async function onDeleteSelectedTask() {
    if (!selectedTaskId) return;
    const ok = window.confirm(
      "Delete this task?\n\nThis will remove the task and its comments and attachments.",
    );
    if (!ok) return;
    await deleteTask({ id: selectedTaskId as any });
    setSelectedTaskId(null);
    setToast("Task deleted");
    setTimeout(() => setToast(null), 3000);
  }

  async function onCreateProject() {
    setNewProjectError(null);
    const name = newProjectName.trim();
    if (!name) return;

    if (!isValidHttpUrl(newProjectDriveUrl)) {
      setNewProjectError("Drive URL must start with http:// or https://");
      return;
    }

    const id = await createProject({
      name,
      description: newProjectDesc.trim() || undefined,
      driveUrl: newProjectDriveUrl.trim() || undefined,
    });
    setNewProjectName("");
    setNewProjectDesc("");
    setNewProjectDriveUrl("");
    setCreateProjectOpen(false);
    setActiveProjectId(id as any);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>

        <div className="sectionTitle">Navigation</div>
        <div className="form">
          <Link className="btn btnGhost" to="/projects">
            Projects
          </Link>
        </div>

        <div className="sectionTitle">Create Task</div>
        <div className="form">
          <input
            className="input"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="input textarea"
            placeholder="Description optional"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="row" style={{ display: "flex", gap: 8 }}>
            <select
              className="input"
              value={activeProjectId ?? ""}
              onChange={(e) => setActiveProjectId(e.target.value || null)}
              style={{ flex: 1 }}
            >
              <option value="">All Projects view</option>
              {(projects ?? []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              className="btn btnGhost"
              onClick={() => setCreateProjectOpen(true)}
              title="Create project"
            >
              New
            </button>
          </div>

          <button className="btn" onClick={onCreateTask}>
            Create
          </button>

          <button
            className="btn btnSmall btnGhost"
            onClick={() => backfillTaskProjectIds({})}
            title="One time migration to assign tasks to projects"
          >
            Backfill projects
          </button>
        </div>

        <div className="sectionTitle">Agents</div>
        <div className="agentList">
          {(agents ?? []).map((a) => (
            <div key={a._id} className="agent">
              <div className="agentName">{a.name}</div>
              <div className="agentRole">{a.role}</div>
              <div className="agentMeta">
                <span className="pill">{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="title">Mission Queue</div>
            <div className="subtitle">MVP tasks and comments</div>
          </div>

          <div className="topbarActions">
            <select
              className="input inputSmall"
              value={activeProjectId ?? ""}
              onChange={(e) => setActiveProjectId(e.target.value || null)}
            >
              <option value="">All Projects</option>
              {(projects ?? []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            {activeProjectId ? (
              <button
                className="btn btnSmall btnGhost"
                onClick={() => setActiveProjectId(null)}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <div className="board">
          {STATUSES.map((s) => (
            <Column
              key={s.key}
              status={s.key}
              title={s.title}
              projectIdFilter={activeProjectId}
              projectNameById={projectNameById}
              onSelect={(id) => setSelectedTaskId(id)}
            />
          ))}
        </div>
      </main>

      <aside className="rightbar">
        <div className="sectionTitle">Live Feed</div>
        <div className="feed">
          {(activities ?? []).map((ev) => (
            <div key={ev._id} className="feedItem">
              <div className="feedType">{ev.type}</div>
              <div className="feedMsg">{ev.message}</div>
              <div className="feedTime">{new Date(ev.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </aside>

      <Modal
        open={!!selectedTaskId}
        title={selectedTask?.title ?? "Task"}
        onClose={() => setSelectedTaskId(null)}
        onDelete={onDeleteSelectedTask}
      >
        <div className="taskMeta">
          <div className="metaRow">
            <span className="pill">{selectedTask?.status ?? ""}</span>
            {selectedTask?.projectId ? (
              <span className="pill pillMuted">
                {projectNameById[selectedTask.projectId] ?? "Project"}
              </span>
            ) : null}
          </div>

          <div>
            <div className="sectionTitle">Project</div>
            <div className="moveRow">
              <select
                key={selectedTaskId ?? "none"}
                className="input inputSmall"
                value={selectedTask?.projectId ?? ""}
                onChange={async (e) => {
                  if (!selectedTaskId) return;
                  const val = e.target.value || undefined;
                  await setProjectId({
                    id: selectedTaskId as any,
                    projectId: val as any,
                  });
                }}
              >
                <option value="">No project</option>
                {(projects ?? []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedTask?.projectId ? (
                <Link
                  className="btn btnSmall btnGhost"
                  to={`/projects/${selectedTask.projectId}`}
                >
                  Open
                </Link>
              ) : null}
            </div>
          </div>

          <div>
            <div className="sectionTitle">Due date</div>
            <div className="moveRow">
              <input
                className="input inputSmall"
                type="date"
                value={selectedTask?.dueDate ?? ""}
                onChange={async (e) => {
                  if (!selectedTaskId) return;
                  const val = e.target.value || undefined;
                  await setDueDate({ id: selectedTaskId as any, dueDate: val });
                }}
              />
              {selectedTask?.dueDate ? (
                <button
                  className="btn btnSmall btnGhost"
                  onClick={async () => {
                    if (!selectedTaskId) return;
                    await setDueDate({ id: selectedTaskId as any, dueDate: undefined });
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <div className="sectionTitle">Assignees</div>
            <div className="moveRow">
              {nonLeadAgents.map((a) => {
                const checked = (selectedTask?.assigneeIds ?? []).includes(a._id);
                return (
                  <label key={a._id} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(a._id)}
                    />
                    {a.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="sectionTitle">Move</div>
            <div className="moveRow">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  className="btn btnSmall btnGhost"
                  onClick={() => onMove(s.key)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="sectionTitle">Description</div>
          <div className="taskDesc">{selectedTask?.description ?? "(none)"}</div>

          <div className="sectionTitle">Comments</div>
          <div className="comments">
            {(selectedMessages ?? []).map((m) => (
              <div key={m._id} className="comment">
                <div className="commentTop">
                  <div className="commentAuthor">{m.fromAgentName}</div>
                  <div className="commentTime">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
                <CommentBody content={m.content} contentHtml={m.contentHtml} />
              </div>
            ))}
          </div>

          <div className="commentBox">
            <textarea
              className="input textarea"
              placeholder="Write a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="btn" onClick={onAddComment}>
              Send
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={createProjectOpen}
        title="Create Project"
        onClose={() => setCreateProjectOpen(false)}
      >
        <div className="form">
          <input
            className="input"
            placeholder="Project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <textarea
            className="input textarea"
            placeholder="Description"
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
          />
          <input
            className="input"
            placeholder="Drive URL (optional)"
            value={newProjectDriveUrl}
            onChange={(e) => setNewProjectDriveUrl(e.target.value)}
          />
          {newProjectError ? <div className="error">{newProjectError}</div> : null}
          <button className="btn" onClick={onCreateProject}>
            Create
          </button>
        </div>
      </Modal>

      {toast ? (
        <div className="toast">
          <div className="toastContent">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectsListPage() {
  const projects = useQuery(api.projects.list, {});
  const navigate = useNavigate();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>
        <div className="sectionTitle">Navigation</div>
        <div className="form">
          <Link className="btn btnGhost" to="/">
            Mission Queue
          </Link>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="title">Projects</div>
            <div className="subtitle">Project pages + per-project board</div>
          </div>
        </div>

        <div className="list">
          {(projects ?? []).map((p) => (
            <button
              key={p._id}
              className="card cardButton"
              onClick={() => navigate(`/projects/${p._id}`)}
            >
              <div className="cardTitle">{p.name}</div>
              {p.description ? <div className="cardDesc">{p.description}</div> : null}
              {p.driveUrl ? (
                <div className="cardMeta">
                  <a
                    href={p.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {p.driveUrl}
                  </a>
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </main>

      <aside className="rightbar" />
    </div>
  );
}

function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = id as string;

  const [toast, setToast] = useState<string | null>(null);

  const agents = useQuery(api.agents.list, {});

  const project = useQuery(
    api.projects.get,
    projectId ? ({ id: projectId as any } as any) : ("skip" as any),
  );

  const updateProject = useMutation(api.projects.update);

  const projects = useQuery(api.projects.list, {});
  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects ?? []) m[p._id] = p.name;
    return m;
  }, [projects]);

  const createTask = useMutation(api.tasks.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const setAssignees = useMutation(api.tasks.setAssignees);
  const setProjectId = useMutation(api.tasks.setProjectId);
  const setDueDate = useMutation(api.tasks.setDueDate);
  const deleteTask = useMutation(api.tasks.remove);
  const createMessage = useMutation(api.messages.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useQuery(
    api.taskDetail.get,
    selectedTaskId ? { id: selectedTaskId as any } : ("skip" as any),
  );

  const nonLeadAgents = useMemo(() => {
    // Allow assigning to Marcus/Epictetus/Seneca/Harold.
    return agents ?? [];
  }, [agents]);

  const selectedMessages = useQuery(
    api.messages.listForTask,
    selectedTaskId ? { taskId: selectedTaskId as any } : ("skip" as any),
  );

  const myAgent = useMemo(() => {
    // The human user (Harold) is the UI commenter by default.
    // Temporary stand-in until we add auth.
    return (
      (agents ?? []).find((a) => a.name === "Harold") ??
      (agents ?? []).find((a) => a.name === "Marcus") ??
      null
    );
  }, [agents]);

  const [comment, setComment] = useState("");

  // Sync local fields once project loads.
  useEffect(() => {
    if (!project) return;
    setName(project.name ?? "");
    setDescription(project.description ?? "");
    setDriveUrl(project.driveUrl ?? "");
  }, [project?._id]);

  async function onSave() {
    setErr(null);
    if (!projectId) return;
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    if (!isValidHttpUrl(driveUrl)) {
      setErr("Drive URL must start with http:// or https://");
      return;
    }

    await updateProject({
      id: projectId as any,
      name: name.trim(),
      description: description.trim(),
      driveUrl: driveUrl.trim(),
    });
  }

  async function onCreateTask() {
    const title = newTitle.trim();
    if (!title) return;

    const id = await createTask({
      title,
      description: newDesc.trim() || undefined,
      projectId: projectId as any,
      status: "inbox",
      assigneeIds: [],
    });

    setNewTitle("");
    setNewDesc("");
    setSelectedTaskId(id);
  }

  async function onMove(status: string) {
    if (!selectedTaskId) return;
    await updateStatus({ id: selectedTaskId as any, status });
  }

  async function toggleAssignee(agentId: string) {
    if (!selectedTaskId || !selectedTask) return;
    const current = (selectedTask.assigneeIds as string[]) ?? [];
    const next = current.includes(agentId)
      ? current.filter((x) => x !== agentId)
      : [...current, agentId];
    await setAssignees({ id: selectedTaskId as any, assigneeIds: next as any });
  }

  async function onAddComment() {
    if (!selectedTaskId || !myAgent) return;
    const text = comment.trim();
    if (!text) return;
    await createMessage({
      taskId: selectedTaskId as any,
      fromAgentId: myAgent._id as any,
      content: text,
    });
    setComment("");
  }

  async function onDeleteSelectedTask() {
    if (!selectedTaskId) return;
    const ok = window.confirm(
      "Delete this task?\n\nThis will remove the task and its comments and attachments.",
    );
    if (!ok) return;
    await deleteTask({ id: selectedTaskId as any });
    setSelectedTaskId(null);
    setToast("Task deleted");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Mission Control</div>

        <div className="sectionTitle">Navigation</div>
        <div className="form">
          <Link className="btn btnGhost" to="/">
            Mission Queue
          </Link>
          <Link className="btn btnGhost" to="/projects">
            All Projects
          </Link>
        </div>

        <div className="sectionTitle">Project Details</div>
        <div className="form">
          <input
            className="input"
            value={name}
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="input textarea"
            value={description}
            placeholder="Description"
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="input"
            value={driveUrl}
            placeholder="Drive URL (optional)"
            onChange={(e) => setDriveUrl(e.target.value)}
          />
          {err ? <div className="error">{err}</div> : null}
          <button className="btn" onClick={onSave}>
            Save
          </button>
          {project?.driveUrl ? (
            <a href={project.driveUrl} target="_blank" rel="noopener noreferrer">
              Open Drive
            </a>
          ) : null}
        </div>

        <div className="sectionTitle">Create Task</div>
        <div className="form">
          <input
            className="input"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="input textarea"
            placeholder="Description optional"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <button className="btn" onClick={onCreateTask}>
            Create
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="title">{project?.name ?? "Project"}</div>
            <div className="subtitle">Project board</div>
          </div>
        </div>

        <div className="board">
          {STATUSES.map((s) => (
            <Column
              key={s.key}
              status={s.key}
              title={s.title}
              projectIdFilter={projectId}
              projectNameById={projectNameById}
              onSelect={(tid) => setSelectedTaskId(tid)}
            />
          ))}
        </div>
      </main>

      <aside className="rightbar" />

      <Modal
        open={!!selectedTaskId}
        title={selectedTask?.title ?? "Task"}
        onClose={() => setSelectedTaskId(null)}
        onDelete={onDeleteSelectedTask}
      >
        <div className="taskMeta">
          <div className="metaRow">
            <span className="pill">{selectedTask?.status ?? ""}</span>
            {selectedTask?.projectId ? (
              <span className="pill pillMuted">
                {projectNameById[selectedTask.projectId] ?? "Project"}
              </span>
            ) : null}
          </div>

          <div>
            <div className="sectionTitle">Project</div>
            <div className="moveRow">
              <select
                key={selectedTaskId ?? "none"}
                className="input inputSmall"
                value={selectedTask?.projectId ?? ""}
                onChange={async (e) => {
                  if (!selectedTaskId) return;
                  const val = e.target.value || undefined;
                  await setProjectId({
                    id: selectedTaskId as any,
                    projectId: val as any,
                  });
                }}
              >
                <option value="">No project</option>
                {(projects ?? []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="sectionTitle">Due date</div>
            <div className="moveRow">
              <input
                className="input inputSmall"
                type="date"
                value={selectedTask?.dueDate ?? ""}
                onChange={async (e) => {
                  if (!selectedTaskId) return;
                  const val = e.target.value || undefined;
                  await setDueDate({ id: selectedTaskId as any, dueDate: val });
                }}
              />
              {selectedTask?.dueDate ? (
                <button
                  className="btn btnSmall btnGhost"
                  onClick={async () => {
                    if (!selectedTaskId) return;
                    await setDueDate({ id: selectedTaskId as any, dueDate: undefined });
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <div className="sectionTitle">Assignees</div>
            <div className="moveRow">
              {nonLeadAgents.map((a) => {
                const checked = (selectedTask?.assigneeIds ?? []).includes(a._id);
                return (
                  <label key={a._id} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(a._id)}
                    />
                    {a.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="sectionTitle">Move</div>
            <div className="moveRow">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  className="btn btnSmall btnGhost"
                  onClick={() => onMove(s.key)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div className="sectionTitle">Description</div>
          <div className="taskDesc">{selectedTask?.description ?? "(none)"}</div>

          <div className="sectionTitle">Comments</div>
          <div className="comments">
            {(selectedMessages ?? []).map((m) => (
              <div key={m._id} className="comment">
                <div className="commentTop">
                  <div className="commentAuthor">{m.fromAgentName}</div>
                  <div className="commentTime">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
                <CommentBody content={m.content} contentHtml={m.contentHtml} />
              </div>
            ))}
          </div>

          <div className="commentBox">
            <textarea
              className="input textarea"
              placeholder="Write a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="btn" onClick={onAddComment}>
              Send
            </button>
          </div>
        </div>
      </Modal>

      {toast ? (
        <div className="toast">
          <div className="toastContent">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MissionQueuePage />} />
      <Route path="/projects" element={<ProjectsListPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
    </Routes>
  );
}
