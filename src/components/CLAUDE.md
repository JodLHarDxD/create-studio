# src/components/CLAUDE.md — Component Quick Reference

> Read `src/CLAUDE.md` for full patterns. This file is a fast lookup for component-specific rules.

---

## Component Map

```
layout/Shell.tsx
  ├── auth/Login.tsx          (renders when loginState === 'logged_out')
  ├── explorer/Explorer.tsx   (left sidebar, 280px)
  ├── editor/EditorPanel.tsx  (center, flex-1)
  │   └── Monaco Editor
  ├── chat/ChatPanel.tsx      (right sidebar, 380px)
  ├── dashboard/Dashboard.tsx (replaces editor when view === 'dashboard')
  └── profile/Profile.tsx     (replaces editor when view === 'profile')

tasks/NewTaskModal.tsx        (portal overlay, opened from Explorer)
```

---

## Per-Component Rules

### Login.tsx
- Mode toggle: `'login' | 'register'` — single form, state-switched
- Register creates Supabase auth user + inserts profile row
- Role on register: user selects ADMIN or MEMBER from dropdown
- Guest mode: sets demo profile, loginState='guest', no Supabase calls
- Error display: show `err.message` directly — Supabase errors are user-readable

### Shell.tsx
- Activity bar is 56px wide (`w-14`), fixed, never collapses
- Sidebar animates open/close via `motion/react` AnimatePresence
- Chat panel animates open/close same way
- Status bar is fixed bottom, 24px high, z-30
- Terminal panel inside editor view is 176px high (`h-44`), hardcoded fake output
- Logout calls `context.logout()` — do NOT call `supabase.auth.signOut()` directly

### Explorer.tsx
- `isAdmin` = `userRole === 'ADMIN'` — no TASK_MANAGER role exists in this version
- `visibleTasks` applies RBAC filter — NEVER let members see all tasks
- File list is scrollable, max-h-48 — files beyond this scroll
- Task list takes remaining height, overflow-y-auto
- Task action buttons appear on hover (`group-hover:opacity-100`)
- File upload handles `.zip` (JSZip extract) and plain files
- Folder upload uses `webkitdirectory` attribute

### EditorPanel.tsx
- `localContent` is separate from `activeFile.content` for performance
- `isDirty` tracks unsaved changes — shown as `●` in tab
- `getLanguage(filename)` → returns Monaco language string — add mappings here
- Save sequence: supabase.update() → /api/ai/files (non-blocking fetch)
- Editor `readOnly` is always false — all roles can edit locally, RBAC is at save level
- Ctrl+S listener is added/removed via useEffect with cleanup

### ChatPanel.tsx
- `messages` is local state — not persisted, resets on page refresh
- Model dropdown renders grouped by provider (`modelsByProvider`)
- `PROVIDER_COLORS` maps provider → hex color for badge dots
- Settings overlay is absolutely positioned over the chat panel (inset-0)
- `keySaved` state shows brief success state on save (1.2s then closes)
- Error messages are injected as assistant messages with `>` prefix
- Context badges (file + task) appear between header and messages
- `activeTask` is resolved as: first IN_PROGRESS task assigned to currentUserId

### Dashboard.tsx
- `visibleTasks` is RBAC-filtered — same pattern as Explorer
- Admin gets: stat cards + pie chart + bar chart + overdue alert + task log
- Member gets: stat cards + progress bar + own task log only
- Overdue = `status !== 'DONE' && due_date && new Date(due_date) < now`
- `userLoad` bar chart: per-user task count, admin-only, computed with `useMemo`
- Chart colors: white = done/total, blue = in progress, dim white = todo

### Profile.tsx
- Form state (`form`) is separate from `profile` context state
- `handleSave` updates Supabase then calls `setProfile()` to update context
- Guest mode: `setIsEditing(false)` without saving (read-only for guests)
- `myTasks` = tasks where `assignee_id === currentUserId`
- Completion rate = `(done.length / myTasks.length) * 100`

### NewTaskModal.tsx
- `projects[0]?.id` — uses first project (single-project scope)
- Guest mode: optimistic update to `setTasks` — no Supabase call
- Form resets after successful submit
- Required fields: `title`, `project_id`
- Due date defaults to today

---

## Import Aliases

```typescript
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { AI_MODELS, getStoredKeys, saveKeys } from '@/lib/aiModels';
import { cn } from '@/lib/utils';
```

`@/` resolves to `src/` — configured in `vite.config.ts` and `tsconfig.json`.

---

## Shared UI Patterns

### Loading state
```tsx
{isLoading ? (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="animate-spin opacity-40" size={20} />
  </div>
) : content}
```

### Empty state
```tsx
<div className="p-8 text-center text-[10px] opacity-20 uppercase tracking-widest">
  No items found.
</div>
```

### Error display
```tsx
{error && (
  <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-mono">
    {error}
  </div>
)}
```

### Status badge (task status)
```tsx
<span className={cn(
  "text-[8px] font-black uppercase tracking-widest px-2 py-1 border",
  status === 'DONE' ? "bg-white text-black border-white" :
  status === 'IN_PROGRESS' ? "text-blue-400 border-blue-400/30" :
  "text-white/30 border-white/10"
)}>
  {status.replace('_', ' ')}
</span>
```

### Role badge
```tsx
<span className="flex items-center gap-1 border border-white/20 px-2 py-1 text-[9px] uppercase font-black tracking-widest opacity-60">
  <Activity size={11} /> {userRole}
</span>
```
