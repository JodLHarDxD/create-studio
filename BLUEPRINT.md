# BLUEPRINT.md — TeamForge Feature Map

> This is the living task board for Claude Code. Update status as work completes. Read before starting any session to know exactly where things stand.

---

## Completion Status

### Core Infrastructure
| Feature | Status | File(s) |
|---------|--------|---------|
| Supabase client setup | ✅ Done | `src/lib/supabaseClient.ts` |
| Auth (login + register) | ✅ Done | `src/components/auth/Login.tsx` |
| WorkspaceContext (global state) | ✅ Done | `src/contexts/WorkspaceContext.tsx` |
| Real-time subscriptions (tasks + files) | ✅ Done | `WorkspaceContext.tsx` |
| Guest/demo mode | ✅ Done | `WorkspaceContext.tsx` (DEMO_* constants) |
| Database schema + RLS | ✅ Done | `database_setup.sql` |
| Railway deploy config | ✅ Done | `railway.json`, `Procfile` |
| Vercel deploy config | ✅ Done | `vercel.json` |

### Frontend Components
| Component | Status | Notes |
|-----------|--------|-------|
| Shell (IDE layout) | ✅ Done | Activity bar + 3-panel layout |
| Login | ✅ Done | Supabase auth, register+login, guest mode |
| Explorer (file tree + tasks) | ✅ Done | RBAC applied, ZIP upload, new file |
| Monaco Editor | ✅ Done | Language detection, Ctrl+S, dirty state |
| AI Chat Panel | ✅ Done | Multi-model dropdown, settings modal, context badges |
| Dashboard | ✅ Done | Pie + bar charts, RBAC-gated admin analytics, overdue alert |
| Profile | ✅ Done | Editable name/bio/github, task history |
| NewTaskModal | ✅ Done | Supabase insert, guest-mode fallback |

### Backend
| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /api/ai/chat` | ✅ Done | Multi-provider: Anthropic, OpenAI, Google |
| `POST /api/ai/files` | ✅ Done | Saves file + generates vector embedding |
| `GET /health` | ✅ Done | Railway health check |
| RAG pipeline | ✅ Done | Embedding → pgvector search → prompt injection |
| Key resolution | ✅ Done | User key > server env var |

### Pending / Enhancement Queue
| Task | Priority | Complexity | Notes |
|------|----------|------------|-------|
| Project switcher (multi-project) | HIGH | Medium | Currently loads first project only |
| Admin: create new project from UI | HIGH | Low | Add button in Shell activity bar |
| Admin: invite user to project | HIGH | Medium | Needs `project_members` table |
| Task comments / thread | MEDIUM | Medium | Add `task_comments` table + UI in task detail |
| File rename / delete | MEDIUM | Low | Add context menu in Explorer file list |
| Tab management in editor (multi-file) | MEDIUM | High | Track open tabs, close buttons work |
| Streaming AI responses | MEDIUM | Medium | Use SSE for token-by-token output |
| Chat history persistence | MEDIUM | Medium | Save messages to `chat_messages` Supabase table |
| Admin: user management panel | LOW | Medium | List all users, change roles |
| Mobile responsive layout | LOW | High | Currently desktop-first |
| Dark/light theme toggle | LOW | Low | Add to Shell settings |

---

## Architecture Decisions Log

### Why no SSR / Next.js?
Assignment requires Railway deployment + 24hr build. Vite SPA = zero config, instant Railway deploy via static build served by any CDN or the FastAPI itself.

### Why httpx instead of official SDKs (anthropic, openai)?
- No version conflicts between 3 SDKs
- One dependency, same async pattern
- User-provided API keys slot in as headers identically across providers
- Easier to add new providers (just add a new `call_X()` function)

### Why pgvector dimension 768?
Gemini `text-embedding-004` outputs 768-dimensional vectors. This is the free Google embedding model. If switching to OpenAI embeddings (3072-dim) or Anthropic (1024-dim), the `embedding vector(768)` column must be recreated.

### Why Supabase service role key in backend only?
Frontend uses anon key → RLS applies → members can't read other members' data.
Backend uses service role key → RLS bypassed → can write embeddings to any row.
This is intentional — the backend is trusted, the frontend is not.

### Why localStorage for API keys?
No server liability. Company can distribute one key via docs. Users keep autonomy. Keys survive page refresh. Keys are wiped when user clears browser data (correct behavior).

---

## Known Issues

| Issue | Severity | Workaround | Fix Target |
|-------|----------|------------|------------|
| Editor `readOnly` — currently false for all roles | None | Members can edit locally, save goes to backend RBAC | — |
| Single project scope — only loads first project | Low | Works for assignment, multi-project needs switcher UI | Enhancement queue |
| RAG requires Google key even for non-Google models | Low | Embedding always uses Gemini — if no Google key, RAG skipped silently | OK for now |
| Chat history not persisted across sessions | Medium | Messages live in component state only | Enhancement queue |
| `match_project_files` RPC requires pgvector extension | None | SQL setup handles this | — |

---

## Data Flow Diagrams

### Auth Flow
```
User enters email+password
→ supabase.auth.signInWithPassword()
→ Supabase returns JWT
→ WorkspaceContext sets: currentUserId, userRole, profile, loginState='logged_in'
→ useEffect triggers data load
→ Shell renders IDE layout
```

### AI Chat Flow
```
User types message + selects model
→ ChatPanel reads: activeFile.content, activeTask, selectedModel, project_id
→ Reads API keys from localStorage
→ POST /api/ai/chat { user_message, model_id, provider, active_file_content, active_task, project_id, api_keys }
→ Backend: resolve_key() picks user key or server env
→ Backend: embed user_message with Gemini → query pgvector → get RAG context
→ Backend: build system prompt with file + task + RAG context
→ Backend: route to call_anthropic / call_openai / call_google
→ Return { response, model, provider, rag_used, rag_files }
→ ChatPanel renders response with model badge
```

### File Save + Embedding Flow
```
User edits file in Monaco → Ctrl+S or Save button
→ EditorPanel: supabase.from('project_files').update({ content }) — immediate
→ EditorPanel: POST /api/ai/files { file_id, content, project_id, file_name }
→ Backend: get_google_embedding(content) [non-blocking]
→ Backend: supabase.update({ embedding: vector }) [bypasses RLS via service key]
→ Next AI chat: this file is now searchable via RAG
```

### Real-Time Update Flow
```
Any client updates a task in Supabase
→ Supabase broadcasts postgres_changes event
→ WorkspaceContext channel subscription fires
→ refetchTasks() re-fetches from Supabase
→ React re-renders Explorer + Dashboard with new data
```

---

## File-by-File Responsibility Map

```
WorkspaceContext.tsx    → owns: auth state, all data arrays, refetch functions, selectedModel
Shell.tsx               → owns: view routing, layout skeleton, logout
Explorer.tsx            → owns: file selection, task RBAC display, task actions, file upload
EditorPanel.tsx         → owns: Monaco instance, file save, embedding trigger, language detection
ChatPanel.tsx           → owns: message history, model switching, key settings, AI API calls
Dashboard.tsx           → owns: analytics charts, overdue detection, RBAC-gated admin view
Login.tsx               → owns: Supabase auth calls, role assignment on first login
Profile.tsx             → owns: profile read/edit, task completion stats
NewTaskModal.tsx        → owns: task creation form, Supabase insert
ai_chat.py              → owns: ALL AI provider calls, RAG logic, key resolution, embedding
database.py             → owns: Supabase service-role client singleton
supabaseClient.ts       → owns: anon client singleton, TypeScript type definitions
aiModels.ts             → owns: model registry, localStorage key helpers
```

---

## Testing Checklist (Before Submission)

### Auth
- [ ] Register new user → profile created in Supabase `profiles` table
- [ ] Login with existing user → correct role loaded
- [ ] Guest mode → demo data visible, writes don't hit Supabase
- [ ] Logout → clears all state, returns to login screen

### RBAC
- [ ] Admin login → sees all tasks in Explorer and Dashboard charts
- [ ] Member login → sees only own tasks
- [ ] Member cannot access admin analytics (Dashboard shows personal view only)
- [ ] Admin can assign task to any user
- [ ] Member can only take unassigned tasks or update own task status

### AI Chat
- [ ] Settings modal opens → enter API key → Save → key persists after page refresh
- [ ] Select Anthropic model → send message → response arrives with Anthropic badge
- [ ] Select OpenAI model → send message → response arrives with OpenAI badge
- [ ] Select Google model → send message → response arrives with Google badge
- [ ] Switch model mid-conversation → conversation history carries over
- [ ] No key set → clear error message (not cryptic 401)
- [ ] Context badges show active file and active task

### Editor
- [ ] Click file in Explorer → content loads in Monaco
- [ ] Edit file → dirty indicator (●) appears in tab
- [ ] Ctrl+S → file saves to Supabase → dirty indicator clears
- [ ] Save triggers embedding (check Supabase `embedding` column is not null)

### Real-Time
- [ ] Open two browser windows, same account
- [ ] Update task status in window 1 → window 2 updates within 2s

### Deployment
- [ ] `npm run build` completes without TypeScript errors
- [ ] `uvicorn backend.main:app` starts without import errors
- [ ] `GET /health` returns `{"status": "operational"}`
- [ ] Frontend can reach backend at `VITE_API_URL`
- [ ] CORS not blocking frontend→backend requests
