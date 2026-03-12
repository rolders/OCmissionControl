# OCmissionControl (Mission Control)

A lightweight “mission control” web app for running multiple projects with multiple agents.

It’s deliberately simple: a kanban-style board, per-task comments, basic agent presence, and project pages — built so OpenClaw (and humans) can triage and coordinate work quickly.

## What’s in here

- **Mission Queue**: kanban board with task statuses (Inbox → Done)
- **Projects**: project list + per-project board
- **Tasks**:
  - title + description
  - assignees (agents)
  - **Due date** (YYYY-MM-DD)
  - **ETA** (date-based; stored as a timestamp)
  - tags (basic)
- **Comments**: plain-text or sanitized HTML rendering
- **Live feed**: recent activity stream

## Tech stack

- **Frontend**: React + Vite + TypeScript
- **Backend/DB**: Convex (queries/mutations + hosting)

## Getting started

### 1) Install deps

```bash
npm install
```

### 2) Set up Convex

In one terminal:

```bash
npx convex dev
```

Convex will guide you through creating/connecting a deployment and will output a `CONVEX_URL`.

### 3) Configure env

Create `.env.local` (or copy from `.env.example`) and set your Convex URL:

```bash
cp .env.example .env.local
```

At minimum you need:

- `CONVEX_URL` (used by Convex tooling)
- `VITE_CONVEX_URL` (used by the Vite client)

### 4) Run the app

```bash
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). 

## Scripts

- `npm run dev` — run the Vite dev server
- `npm run build` — build production assets
- `npm run preview` — preview the production build
- `npm run convex:dev` — run Convex in dev mode

## Notes / design choices

- **No auth (yet):** the UI currently defaults the “comment author” to an agent named **Harold**, falling back to **Marcus**.
- **HTML safety:** comments are rendered either as plain text (line breaks preserved) or sanitized HTML (restricted tags/attrs).
- **Local persistence:** board filters (project / due / ETA / sort mode) are stored in `localStorage`.

## Repository layout

- `src/` — React app
- `convex/` — Convex schema + functions
- `scripts/` — helper scripts (triage, summaries, etc.)
- `dist/` — build output (generated)

## Roadmap (ideas)

- Authentication + per-user identity
- Better agent presence + assignment rules
- Attachments + linking (Drive, docs, etc.)
- Saved views/filters + notifications

---

If you’re running this under OpenClaw, treat this repo as the UI/ops surface: triage in Mission Control, execute in agents.
