# CLAUDE.md — TeamForge Master Context

> Read this file completely before touching any code. It encodes all architectural decisions, patterns, and invariants. Violating these causes breakage.

---

## What This Project Is

**TeamForge** — A VSCode-style team task manager with a context-aware AI developer assistant supporting multiple LLM providers simultaneously.

**Evaluator context:** An AI company assessing engineering maturity. They will test RBAC, AI integration, real-time data, and deployment. Every decision must signal production thinking.

---

## Stack — Non-Negotiable

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React 18 + Vite + TypeScript | Type safety, fast builds |
| Styling | Tailwind v4 (`@tailwindcss/vite`) | No PostCSS config needed |
| Editor | `@monaco-editor/react` | Actual VSCode engine |
| Database | Supabase (PostgreSQL + pgvector + RLS) | Auth + real-time + vector search |
| Backend | FastAPI (Python) | Async, AI-first, industry standard |
| AI | Anthropic / OpenAI / Google via direct httpx | No SDK lock-in, user key flexibility |
| Deploy | Railway (backend) + Vercel (frontend) | Both free tier, production-grade |

**CRITICAL: This project uses Supabase, NOT Firebase. Firebase was in the original scaffold and has been fully removed. Never reintroduce Firebase imports.**

---

## Repository Layout

```
teamforge/
├── CLAUDE.md                   ← YOU ARE HERE
├── BLUEPRINT.md                ← Feature map + completion status
├── backend/
│   ├── CLAUDE.md               ← Backend-specific context
│   ├── main.py                 ← FastAPI app entry
│   ├── database.py             ← Supabase service-role client
│   ├── models.py               ← Pydantic schemas
│   ├── requirements.txt
│   └── routers/
│       └── ai_chat.py          ← ALL AI logic lives here
├── src/
│   ├── App.tsx                 ← Root: WorkspaceProvider + Shell
│   ├── main.tsx
│   ├── index.css
│   ├── contexts/
│   │   └── WorkspaceContext.tsx ← Single source of truth for all state
│   ├── lib/
│   │   ├── supabaseClient.ts   ← Supabase client + type definitions
│   │   ├── aiModels.ts         ← Model registry + localStorage key management
│   │   └── utils.ts            ← cn() only
│   └── components/
│       ├── auth/Login.tsx      ← Supabase email auth, register+login
│       ├── layout/Shell.tsx    ← IDE layout: sidebar + editor + chat
│       ├── explorer/Explorer.tsx ← File tree + task list + RBAC
│       ├── editor/EditorPanel.tsx ← Monaco + Supabase save + embedding trigger
│       ├── chat/ChatPanel.tsx  ← Multi-model AI chat, free model switching
│       ├── dashboard/Dashboard.tsx ← Analytics, RBAC-gated charts
│       ├── profile/Profile.tsx ← User profile, editable
│       └── tasks/NewTaskModal.tsx ← Task creation modal
├── database_setup.sql          ← Run ONCE in Supabase SQL Editor
├── .env.example                ← Copy to .env, fill in values
├── package.json
├── vite.config.ts
├── railway.json                ← Backend deploy config
└── vercel.json                 ← Frontend SPA routing config
```

---

## Core Architectural Invariants

### 1. State Management
- **Single context** — `WorkspaceContext` is the only global state. Do NOT add Redux, Zustand, or additional contexts.
- All data flows: `Supabase → WorkspaceContext → components`
- Real-time updates: Supabase channel subscriptions in `WorkspaceContext.tsx` trigger `refetchFiles()` and `refetchTasks()`
- Guest mode: Uses hardcoded DEMO_* constants. Guest writes are state-only (no DB calls).

### 2. RBAC Rules — Never Relax These
```
ADMIN  → sees ALL tasks, manages ALL tasks, assigns anyone, views analytics charts
MEMBER → sees ONLY tasks where assignee_id = currentUserId
         can take unassigned tasks, start own tasks, mark own tasks done
         CANNOT see other members' tasks
         CANNOT access admin analytics
```
RBAC is enforced at two layers:
- **Frontend**: `Explorer.tsx` and `Dashboard.tsx` filter `visibleTasks` based on `userRole`
- **Database**: Supabase RLS policies (defined in `database_setup.sql`) enforce at query level

### 3. AI Key Architecture — Critical
```
User provides key → stored in localStorage ONLY → sent in request payload
Backend uses it for that request → NEVER stores it → NEVER logs it

Priority: user-provided key > server env var (GEMINI_API_KEY etc.)
```
The `resolve_key()` function in `ai_chat.py` implements this. Never change this priority order.

### 4. Multi-Model Pattern
- Model list is the source of truth: `src/lib/aiModels.ts` → `AI_MODELS` array
- Frontend sends `{ model_id, provider }` to backend
- Backend routes to correct provider in `ai_chat.py`:
  - `provider=anthropic` → `call_anthropic()`
  - `provider=openai` → `call_openai()`
  - `provider=google` → `call_google()`
- Adding a new model = add entry to `AI_MODELS` array only. Backend routing handles it automatically if provider matches.

### 5. RAG Pipeline
```
File saved in EditorPanel
  → POST /api/ai/files (backend)
  → get_google_embedding(content) [Gemini text-embedding-004]
  → supabase project_files.embedding = vector(768)

AI chat request
  → get_google_embedding(user_message)
  → supabase.rpc('match_project_files', { query_embedding, threshold: 0.5, count: 3 })
  → inject top-3 matches into system prompt as RAG context
```
RAG is non-blocking — failures are caught and logged, chat still works without it.

---

## Data Models

### Supabase Tables

```sql
profiles       id(uuid PK), email, full_name, role(ADMIN|MEMBER), bio, github_url
projects       id(uuid PK), name, description, owner_id(→profiles)
tasks          id(uuid PK), title, description, status(TODO|IN_PROGRESS|DONE),
               project_id(→projects), assignee_id(→profiles), due_date
project_files  id(uuid PK), project_id(→projects), file_name, path,
               content(text), embedding(vector 768), updated_at
```

### TypeScript Types (src/lib/supabaseClient.ts)

```typescript
Profile { id, email, full_name, role: 'ADMIN'|'MEMBER', bio?, github_url? }
Project { id, name, description?, owner_id }
Task    { id, title, description?, status, project_id, assignee_id?, due_date? }
ProjectFile { id, project_id, file_name, path, content, updated_at? }
```

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://your-backend.railway.app
```

### Backend (Railway env vars)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← service role, bypasses RLS for embeddings
GEMINI_API_KEY=AIza...            ← optional server default for Google models
```

**Never expose `SUPABASE_SERVICE_ROLE_KEY` or any AI key to the frontend.**

---

## Common Operations

### Add a new AI model
1. Open `src/lib/aiModels.ts`
2. Add entry to `AI_MODELS` array with correct `provider` field
3. If new provider (e.g. Mistral): add `call_mistral()` in `backend/routers/ai_chat.py` and add branch in `/chat` endpoint
4. That's it. Frontend dropdown auto-populates.

### Add a new task field
1. Add column in `database_setup.sql` → run migration in Supabase
2. Update `Task` interface in `src/lib/supabaseClient.ts`
3. Update `NewTaskModal.tsx` form
4. Update `Explorer.tsx` display if needed

### Add a new page/view
1. Add view type to `WorkspaceContext` → `view` state union type
2. Add button in `Shell.tsx` activity bar
3. Add render branch in `Shell.tsx` center panel
4. Create component in `src/components/`

### Debug Supabase RLS issues
- Test queries in Supabase SQL Editor with `SET LOCAL role = authenticated;`
- Backend uses service role key — it bypasses RLS by design (needed for embeddings)
- Frontend uses anon key — RLS applies to all frontend queries

---

## What NOT To Do

- **Never** reintroduce Firebase or Firestore
- **Never** store API keys in the database or server-side session
- **Never** call AI APIs directly from the frontend (key exposure)
- **Never** add a second state management library
- **Never** change `readOnly` in Monaco Editor to `true` for any role (members need to edit)
- **Never** skip the `resolve_key()` priority — user key must override server key
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- **Never** break guest mode — it must work with zero backend/Supabase connection

---

## Session Start Checklist for Claude Code

Before writing any code in a new session:

1. Read `CLAUDE.md` (this file) ✓
2. Read `BLUEPRINT.md` → identify current task/status
3. Read `backend/CLAUDE.md` if touching backend
4. Check which component you're modifying — read that file first
5. Run a search for the pattern you're about to change to find all usages
6. Never assume state shape — check `WorkspaceContext.tsx` for current types

---

## Deployment Commands

```bash
# Backend (Railway auto-deploys on git push)
# Start command: uvicorn backend.main:app --host 0.0.0.0 --port $PORT

# Frontend local dev
npm install
npm run dev          # Vite dev server on :5173, proxies /api → :8000

# Frontend build
npm run build        # outputs to dist/

# Backend local dev
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Skill routing

When user request matches one below, invoke via Skill tool. Project-scoped commands (`.claude/commands/tf-*`) outrank generic skills.

### TeamForge-specific routes

| User intent | Invoke |
|-------------|--------|
| "new feature" / "build X for TeamForge" | `/tf-feature` |
| "bug" / "X isn't working" / "fix this" | `/tf-bug` |
| "deploy" / "ship the app" / "go live" | `/tf-deploy` |
| "add task field" / "add column" | Follow "Common Operations → Add a new task field". No skill needed. |
| "add AI model" / "new provider" | Follow "Common Operations → Add a new AI model". No skill. |
| "add page" / "new view" | Follow "Common Operations → Add a new page/view". No skill. |
| RBAC / permissions question | Read "RBAC Rules" section. Never relax frontend OR RLS. |
| "save API key in DB" / "persist credential" | REJECT. See "What NOT To Do". Keys live in localStorage only. |
| Supabase RLS debugging | Follow "Debug Supabase RLS issues". |

### General routes

| User intent | Invoke |
|-------------|--------|
| Multi-domain workflow ("make it $1000 frontend", "ship with full review") | `/jodl-forge <goal>` |
| One command, no follow-up | `/jodl-auto <goal>` |
| Code review of branch / diff | `/review` |
| Bug investigation | `/investigate` |
| Live URL QA | `/qa <URL>` |
| Brainstorm feature | `superpowers:brainstorming` |
| Plan execution (multi-step) | `superpowers:writing-plans` → `superpowers:executing-plans` |
| Commit + push + PR | `commit-commands:commit-push-pr` |
| Find right skill (unsure) | `/jodl-retrieve <task>` |
| Security audit | `/cso` |
| Frontend visual polish | `frontend-design:frontend-design` then `/design-review` |
| Performance audit | `chrome-devtools-mcp:debug-optimize-lcp` |
| Accessibility check | `chrome-devtools-mcp:a11y-debugging` |

### Hard constraints (override any skill output)

1. **Supabase only.** Never reintroduce Firebase or Firestore.
2. **API key isolation.** User key → localStorage → request payload. Never DB, never log, never frontend env.
3. **Service role key.** Backend only. Never to frontend.
4. **Single context.** `WorkspaceContext` is the only global state. No Redux/Zustand additions.
5. **RBAC at two layers.** Frontend filter AND Supabase RLS. Never trust one alone.
6. **Guest mode.** Must work with zero backend/Supabase connection.
7. **Monaco `readOnly`.** Stays `false`. Members must edit their own files.
8. **`resolve_key()` priority.** User-provided key > server env var. Never swap.

If a skill's output violates any of these → reject, fix to comply, then proceed. Hard constraints outrank skill recommendations.
