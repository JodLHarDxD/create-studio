# src/CLAUDE.md — Frontend Context

> Read root `CLAUDE.md` first. This file covers frontend-specific patterns, component contracts, and state rules.

---

## Component Contracts

Each component has a clear owner domain. Stay inside it.

### WorkspaceContext — The Single Source of Truth

**What it owns:**
```typescript
// Auth
profile, userRole, currentUserId, loginState
// Data
activeProject, projects, files, tasks, users
// Editor
activeFile, setActiveFile
// UI
view, setView, isLoading
// AI
selectedModel, setSelectedModel
// Actions
refetchFiles, refetchTasks, logout
```

**Rules:**
- Never fetch Supabase data in a component directly — use context state or `refetch*` functions
- Exception: `EditorPanel` calls `supabase.update()` directly for file save (performance — avoids routing through context)
- Never create local state that duplicates context state
- `setTasks` is exposed for guest-mode optimistic updates only

### Shell — Layout Owner
Owns the IDE shell: activity bar, sidebar visibility, chat panel, status bar, view routing. Does NOT own any data. Reads `view` and `loginState` from context, nothing else.

### Explorer — RBAC Enforcer
```typescript
// RBAC filter — NEVER remove this
const visibleTasks = isAdmin
  ? tasks
  : tasks.filter(t => t.assignee_id === currentUserId);
```
Explorer is responsible for rendering RBAC correctly. Dashboard has its own RBAC filter too. Both must stay in sync.

### EditorPanel — Monaco Owner
- Owns local `localContent` state (avoids re-render on every keystroke)
- Syncs to context `activeFile` via `setActiveFile` on change
- Saves to Supabase on Ctrl+S or Save button
- Triggers backend embedding endpoint after save (non-blocking)
- Language detection via `getLanguage(filename)` — extend the ext→language map as needed

### ChatPanel — AI Owner
- Owns `messages` array (local state, not persisted)
- Owns model dropdown state (`modelDropOpen`)
- Owns settings overlay state (`settingsOpen`)
- Reads `selectedModel` from context, writes back via `setSelectedModel`
- Reads `activeFile`, `activeTask` for context injection
- All AI calls go through `fetch('/api/ai/chat')` — never call AI APIs directly

### Dashboard — Analytics Owner
```typescript
// RBAC — admin sees all, member sees own
const visibleTasks = userRole === 'ADMIN'
  ? tasks
  : tasks.filter(t => t.assignee_id === currentUserId);
```
Admin-only features: pie chart, bar chart, per-user load. Member sees progress bar and own task log only.

---

## State Flow Rules

```
Data reads:    Component ← WorkspaceContext ← Supabase
Data writes:   Component → supabase.from().update() → refetch*() → WorkspaceContext → Component
AI calls:      ChatPanel → /api/ai/chat (backend) → response → local messages state
File saves:    EditorPanel → supabase.update() + /api/ai/files (backend, non-blocking)
```

**Guest mode writes:**
```typescript
// Pattern used in Explorer and NewTaskModal for guest writes
if (loginState === 'guest') {
  setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  return; // skip Supabase call
}
```

---

## Styling Rules

- **Tailwind v4** — uses `@tailwindcss/vite` plugin, no `tailwind.config.js` needed
- **Color palette:** `bg-black`, `bg-[#0a0a0a]`, `bg-[#1e1e1e]` (editor), `bg-[#252526]` (tab bar)
- **Text:** `text-[#cccccc]` (main), `text-[#858585]` (muted), `text-white` (active/highlighted)
- **Borders:** `border-white/10` (subtle), `border-white/20` (visible), `border-white` (active)
- **Accent colors:** Blue `#007acc` (VSCode blue), Green for DONE, Red for overdue
- **Typography sizes:** `text-[8px]` labels, `text-[10px]` UI text, `text-[12px]` content, `text-[13px]` editor
- **Font classes:** `font-black uppercase tracking-widest` for labels, `font-mono` for code/IDs
- **Custom scrollbar:** always add `custom-scrollbar` class to scrollable divs (defined in `index.css`)

**Never use:**
- Tailwind color classes like `text-gray-400` — use explicit hex values
- `rounded-lg` or `rounded-xl` — this UI uses `rounded-sm` or no rounding (sharp aesthetic)
- Shadows — this is a flat dark IDE aesthetic

---

## aiModels.ts — Model Registry

```typescript
AI_MODELS: AIModel[]        // source of truth for all available models
MODEL_BY_ID                 // lookup by model_id string
PROVIDER_LABELS             // display names for providers
PROVIDER_COLORS             // hex colors for provider badges in chat

// localStorage helpers
getStoredKeys()             // returns { anthropic, openai, google, baseUrl }
saveKeys(keys)              // persists to localStorage
getSelectedModel()          // returns model_id string or default
setSelectedModel(id)        // persists to localStorage
```

`LS_KEYS` constants define all localStorage key names. Never use raw strings for localStorage access.

---

## supabaseClient.ts — Type Definitions

This file exports:
1. `supabase` — the anon client instance
2. TypeScript interfaces: `Profile`, `Project`, `Task`, `ProjectFile`
3. `UserRole` type alias

When adding new Supabase table columns:
1. Update the SQL in `database_setup.sql`
2. Update the TypeScript interface here
3. Components using that type will get compile errors pointing to what needs updating

---

## Adding Features — Patterns

### New modal/overlay
Follow `NewTaskModal.tsx` pattern:
```typescript
export default function MyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[480px] bg-[#0a0a0a] border border-white/10">
        {/* content */}
      </div>
    </div>
  );
}
```

### New Supabase query in component
```typescript
// Always handle error, always use typed response
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);

if (error) { console.error(error); return; }
if (data) setState(data);
```

### New real-time subscription
Add to `WorkspaceContext.tsx` useEffect, alongside existing subscriptions:
```typescript
const newSub = supabase
  .channel('channel_name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' },
    () => refetchSomething())
  .subscribe();

// Add to cleanup
return () => {
  supabase.removeChannel(newSub);
  // ...existing cleanup
};
```

---

## Common Bugs & Fixes

**Component re-renders on every keystroke in Monaco**
→ `localContent` state in `EditorPanel` is intentional — it's decoupled from context to avoid this
→ Only `setActiveFile` is called (syncing to context) — don't remove this

**Tasks not updating in real-time**
→ Check Supabase channel subscription is set up in `WorkspaceContext`
→ Check the `filter` param matches the actual project_id format (UUID string)
→ Verify Supabase Realtime is enabled for the `tasks` table in Supabase dashboard

**Guest user seeing "Login Required" instead of task actions**
→ Check `loginState === 'guest'` branches — guest IS logged in for UI purposes
→ The correct check is `loginState === 'logged_out'` to hide actions

**Model dropdown not showing after selecting a model**
→ `setModelDropOpen(false)` must be called after selection — check it's in the click handler

**TypeScript error on Supabase data**
→ Always destructure as `const { data, error } = await supabase...`
→ Data is typed as `T[] | null` — always null-check before use

**`motion/react` import error**
→ The package is `motion` (not `framer-motion`) — import as `from 'motion/react'`
