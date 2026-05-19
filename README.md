# CREATstudio — Developer Workspace

A precision-built developer workspace for teams that ship. Task management, live code review, and AI assistance — unified in a VSCode-style IDE with a cinematic dark design system.

## Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind v4 + Monaco Editor
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL + pgvector + RLS)
- **AI**: Claude (Anthropic) / GPT-4o (OpenAI) / Gemini (Google) — user-switchable
- **Animations**: Motion (motion/react) — FLIP, view transitions, cinematic entrances

---

## Setup (Step by Step)

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste `database_setup.sql` → Run
3. Copy **Project URL** and **anon key** from Settings → API

### 2. Backend (Render)
```bash
# Deploy via render.yaml Blueprint — set these env vars in Render dashboard:
# SUPABASE_URL=your-project-url
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# GEMINI_API_KEY=your-google-key (optional server default)
```
Start command: `python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### 3. Frontend (Vercel)
```bash
cp .env.example .env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run dev      # dev server on :5173
npm run build    # production build → dist/
```

---

## AI Configuration

Users configure their API keys in **Settings** (gear icon in chat panel).

Keys are stored in **localStorage only** — never sent to the server, never persisted server-side.
Each request sends the key in the payload, used per-request and discarded.

### Supported Models (switch mid-conversation):

| Provider | Models |
|----------|--------|
| Anthropic | Claude Sonnet 4.5, Claude Haiku 4.5 |
| OpenAI | GPT-4o, GPT-4o Mini |
| Google | Gemini 2.5 Flash, Gemini 2.5 Pro |

---

## RBAC

| Role | Permissions |
|------|-------------|
| **ADMIN** | See all tasks, manage all tasks, assign/reassign, create tasks, view analytics |
| **MEMBER** | See own tasks, update own task status, use editor, use AI chat |

---

## Features

- **Design**: Obsidian dark palette · Syne + DM Sans + JetBrains Mono typography · amber `#f59e0b` accent
- **Monaco Editor** (VSCode engine) with syntax highlighting for 20+ languages
- **Real-time** task & file updates via Supabase subscriptions
- **Multi-model AI chat** — switch between Claude / GPT-4o / Gemini mid-conversation
- **RAG pipeline** — file content embedded on save, top-3 matches injected into AI context
- **Command Palette** — `⌘K` fuzzy search across commands, files, and active tasks
- **Live Diff Viewer** — compare original ZIP vs. member's live synced folder in real time
- **Role-based access control** — enforced at both UI and database (RLS) layers
- **Local folder sync** — open any local directory, link to a task, auto-upload changes
- **Dashboard analytics** — task distribution charts, user load, overdue alerts (ADMIN)
- **WebGL background** + SVG grain overlay on the cinematic login screen
- **Guest / demo mode** — full ADMIN preview with no backend required
