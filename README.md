# TeamForge — AI Developer Workspace

A VSCode-style team task manager with context-aware AI assistant supporting multiple LLM providers.

## Stack
- **Frontend**: React (Vite) + Tailwind + Monaco Editor
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL + pgvector + RLS)
- **AI**: Claude (Anthropic) / GPT-4o (OpenAI) / Gemini (Google) — user-switchable

---

## Setup (Step by Step)

### 1. Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste `database_setup.sql` → Run
3. Copy **Project URL** and **anon key** from Settings → API

### 2. Backend (Railway)
```bash
cd backend
# Deploy to Railway — set these env vars:
# SUPABASE_URL=your-project-url
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# GEMINI_API_KEY=your-google-key (optional server default)
```
Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### 3. Frontend (Vercel or Railway)
```bash
cp .env.example .env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run build
```

---

## AI Configuration

Users configure their API keys in **Settings** (gear icon in chat panel).

Keys are stored in **localStorage only** — never sent to your server.
Each request sends the key in the payload, used per-request, never persisted.

### Supported Models (free-will switching mid-conversation):

| Provider | Models |
|----------|--------|
| Anthropic | Claude Sonnet 4.5, Claude Haiku 4.5 |
| OpenAI | GPT-4o, GPT-4o Mini |
| Google | Gemini 2.5 Flash, Gemini 2.5 Pro |

---

## RBAC

| Role | Permissions |
|------|-------------|
| **ADMIN** | See all tasks, manage all tasks, assign/reassign, create files, view analytics |
| **MEMBER** | See own tasks, update own task status, view editor, use AI chat |

---

## Features
- ✅ Monaco Editor (VSCode engine) with language detection
- ✅ Real-time task & file updates via Supabase subscriptions  
- ✅ Multi-model AI chat (Claude / GPT-4o / Gemini) — switch mid-conversation
- ✅ RAG: file content embedded on save, queried on AI request  
- ✅ Role-based access control (ADMIN / MEMBER)
- ✅ Context-aware AI (knows open file + active task)
- ✅ ZIP file upload → auto-extract to project files
- ✅ Dashboard analytics with task distribution charts
