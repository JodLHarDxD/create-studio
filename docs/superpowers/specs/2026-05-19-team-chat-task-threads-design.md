# Team Chat + Task Threads — Design Spec

**Date:** 2026-05-19
**Status:** Approved (pending user spec review)
**Owner:** CREATstudio
**Predecessors:** Existing TeamPage (directory/leaderboard), dedicated AI ChatPanel (to be removed)

---

## 1. Purpose

Turn CREATstudio into the main place the team interacts. Today the platform has tasks, files, and an isolated per-user AI chat — no team-to-team communication layer. Members leave for Slack/Discord to talk, fragmenting context.

This spec adds:
- **Team Chat:** project-scoped channels + 1-on-1 DMs (cross-project).
- **Task Threads:** comment threads attached to each task.
- **AI as a member:** the dedicated AI panel is removed. AI participates in any channel/DM via the `/ai` slash command, and each user gets a private AI DM (replaces the old panel for personal use).
- **Mentions, reactions, attachments** across all message contexts.

Goal: a member opening the app for any reason ends up in one place where conversation, work, and AI assistance share one surface.

---

## 2. Scope

### In scope
- Channels per project (`#general`, `#dev`, etc.) — open by default, all project members read/post.
- 1-on-1 DMs between any two project members.
- Task threads — one thread per task, opened from the Explorer task list.
- AI bot member: invoked via `/ai <prompt>` in any context; AI's reply is a normal message authored by the bot user. Each user has a private AI DM pinned at the top of their context list.
- @mentions with notification badge + toast.
- Emoji reactions (fixed starter set: 👍 🚀 🔥 ✅ ❤️ 👀).
- File/image attachments (Supabase Storage, ≤10 MB).
- Unread state + read receipts (per user, per context).
- Realtime via Supabase channels (INSERT/UPDATE on messages, reactions, mentions; presence for online dots).
- Dark + lavender skin scoped to the right chat panel + task drawer (rest of site keeps cream until a separate whole-site redesign spec).

### Out of scope (future specs)
- Group DMs (>2 participants).
- Threaded replies inside a channel (`parent_id` reserved on `messages` for forward compat).
- Markdown / code-block rendering.
- Email/push notifications.
- Message search.
- Pinned messages.
- Per-channel typing indicators (presence only).
- Whole-site redesign rollout — separate spec.

---

## 3. Visual Direction

Reference: dark dashboard aesthetic ("NextSkill"-style) — dark navy base, soft lavender accent, generous radii, clean sans-serif.

**Tokens (scoped to chat surfaces via `data-skin="chat-dark"`):**

```css
[data-skin="chat-dark"] {
  --bg-base:       #0E1014;
  --bg-card:       #1A1D24;
  --bg-elevated:   #222630;
  --border:        rgba(255,255,255,0.06);
  --text-1:        #FFFFFF;
  --text-2:        #A8ADB8;
  --text-3:        #6B7080;
  --accent:        #C5B8FF;   /* lavender — actions, unread, active */
  --accent-2:      #E8E2A8;   /* cream — completed / secondary data */
  --success:       #7ED4A8;
  --danger:        #FF8B8B;
  --radius-card:   16px;
  --radius-chip:   10px;
  font-family:     'Inter', 'General Sans', system-ui;
}
```

Stat numbers use `font-variant-numeric: tabular-nums`. Buttons / chips use `--radius-chip`; surfaces use `--radius-card`.

Rest of the site keeps the existing Soft Editorial Light tokens — coexistence is intentional and short-lived (whole-site redesign follows).

---

## 4. Data Model

### Approach choice

**Single unified `messages` table with `context_type` discriminator** — chosen over separate tables per context. Justification: one realtime subscription pattern, uniform reactions/mentions/attachments code across channel/DM/task contexts.

### Schema additions

```sql
-- AI bot flag on existing profiles table
ALTER TABLE profiles ADD COLUMN is_bot bool DEFAULT false;

-- Bot needs an auth.users row first (profiles.id FK requires it).
-- BOT_USER_ID = '00000000-0000-0000-0000-000000000a1c'
-- Insert via Supabase service role (admin API) or raw SQL with service role connection:
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES ('00000000-0000-0000-0000-000000000a1c', 'ai@creatstudio.local', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role, is_bot)
VALUES ('00000000-0000-0000-0000-000000000a1c', 'ai@creatstudio.local', 'AI Assistant', 'MEMBER', true)
ON CONFLICT (id) DO NOTHING;

-- The bot cannot log in (empty encrypted_password). It only exists so FK + author_id work.

-- Channels (project-scoped)
CREATE TABLE channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  archived    boolean DEFAULT false,
  created_at  timestamptz DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- DM threads — canonical pair, smaller_id first
CREATE TABLE dm_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id),
  CHECK(user_a_id < user_b_id)
);

-- Unified messages (channel | dm | task)
CREATE TABLE messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type   text NOT NULL CHECK(context_type IN ('channel','dm','task')),
  context_id     uuid NOT NULL,
  author_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body           text NOT NULL,
  command        text,                                        -- 'ai' if slash-invocation
  replies_to     uuid REFERENCES messages(id) ON DELETE SET NULL,
  model_id       text,                                        -- AI model used (bot messages only)
  created_at     timestamptz DEFAULT NOW(),
  edited_at      timestamptz
);
CREATE INDEX idx_messages_ctx ON messages(context_type, context_id, created_at DESC);
CREATE INDEX idx_messages_author ON messages(author_id);

-- Mentions
CREATE TABLE message_mentions (
  message_id          uuid REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, mentioned_user_id)
);
CREATE INDEX idx_mentions_user ON message_mentions(mentioned_user_id);

-- Reactions
CREATE TABLE message_reactions (
  message_id  uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Attachments
CREATE TABLE message_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,         -- chat-attachments/{project_id}/{message_id}/{filename}
  file_name     text NOT NULL,
  mime_type     text,
  size_bytes    integer
);

-- Unread tracking
CREATE TABLE read_state (
  user_id        uuid REFERENCES profiles(id) ON DELETE CASCADE,
  context_type   text NOT NULL,
  context_id     uuid NOT NULL,
  last_read_at   timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, context_type, context_id)
);
```

### TypeScript additions (`src/lib/supabaseClient.ts`)

```typescript
export interface Channel { id: string; project_id: string; name: string; description: string; created_by: string | null; archived: boolean; created_at: string; }
export interface DMThread { id: string; user_a_id: string; user_b_id: string; created_at: string; }
export interface Message {
  id: string;
  context_type: 'channel' | 'dm' | 'task';
  context_id: string;
  author_id: string;
  body: string;
  command: string | null;
  replies_to: string | null;
  model_id: string | null;
  created_at: string;
  edited_at: string | null;
}
export interface MessageReaction { message_id: string; user_id: string; emoji: string; }
export interface MessageMention { message_id: string; mentioned_user_id: string; }
export interface MessageAttachment { id: string; message_id: string; storage_path: string; file_name: string; mime_type: string | null; size_bytes: number | null; }
export interface ReadState { user_id: string; context_type: string; context_id: string; last_read_at: string; }

export const BOT_USER_ID = '00000000-0000-0000-0000-000000000a1c';
```

---

## 5. UI Layout

### Right panel (always mounted, 360px, single column)

`ChatPanel.tsx` (dedicated AI) is **deleted**. Right panel mount is `TeamChatPanel.tsx`.

```
┌─────────────────────────────────────┐
│ TEAM CHAT          [search] [+]     │
├─────────────────────────────────────┤
│ 🤖 AI Assistant      • pinned       │  ← per-user AI DM, always top
│                                     │
│ ── CHANNELS ──                      │
│ # general              ●2           │
│ # dev                               │
│ # design                            │
│ + new channel  (admin only)         │
│                                     │
│ ── DIRECT MESSAGES ──               │
│ ● Sarah Lee           ●1            │  ← green dot = online
│   Marc Polo                         │
│ + new dm                            │
└─────────────────────────────────────┘
```

When a context is selected, the same panel transitions to the message view:

```
┌─────────────────────────────────────┐
│ ← # general          7 members      │
├─────────────────────────────────────┤
│  [messages scroll, day separators]  │
│  …                                  │
├─────────────────────────────────────┤
│ [📎] type message…  [@] [send]      │
│ slash menu pops above when "/" typed│
└─────────────────────────────────────┘
```

### Task thread drawer

`TaskThreadDrawer.tsx` slides in from the right when an Explorer task row is clicked. Width 480px, overlays both chat panel and editor.

- Header: task title, status pill, assignee avatar, close X.
- Body: task description block + reused `MessageList` rendering messages where `context_type='task'`, `context_id=<task.id>`.
- Footer: reused `MessageComposer` (slash + mentions + attachments enabled).

---

## 6. Components

### New (`src/components/chat-team/`)

| File | Responsibility |
|------|----------------|
| `TeamChatPanel.tsx` | Right-panel root. Owns active context state, applies `data-skin="chat-dark"`. |
| `ContextList.tsx` | AI DM (pinned) + channels + DMs. Unread/mention badges. |
| `ContextHeader.tsx` | Back arrow, title, member count / presence dots. |
| `MessageList.tsx` | Virtualized scroll, day separators, scroll-to-bottom on new msg if at bottom. |
| `MessageItem.tsx` | Renders body, mentions, reactions strip, attachments. Bot styling (lavender border, model badge). Edit/delete menu for own msg within 15 min. |
| `MessageComposer.tsx` | Textarea, slash parser, mention picker, attach button, send. |
| `SlashCommandMenu.tsx` | Popover when `/` typed at line start. Phase 2: only `/ai`. |
| `MentionPicker.tsx` | Popover when `@` typed. Filters project members. |
| `ReactionBar.tsx` | Existing reactions + emoji picker on hover. |
| `AttachmentTile.tsx` | Image preview inline (signed URL) or file chip. |
| `NewChannelModal.tsx` | Admin only. Name, description. |
| `hooks/useActiveContext.ts` | Selected context state (channel/dm/task + id). |
| `hooks/useMessages.ts` | Fetch + realtime subscribe per active context. |
| `hooks/useUnread.ts` | Calls `get_unread_summary` RPC, listens to mention realtime, marks read on context open. |
| `hooks/useSlashCommand.ts` | Detect/parse slash invocations in composer. |
| `hooks/useMentionAutocomplete.ts` | `@` autocomplete state machine. |

### New (`src/components/tasks/`)

| File | Responsibility |
|------|----------------|
| `TaskThreadDrawer.tsx` | Slide-in drawer, reuses `MessageList` + `MessageComposer`. |

### New (`src/contexts/`)

| File | Responsibility |
|------|----------------|
| `ChatContext.tsx` | Active context, active task thread, unread map, presence state, online users. Wraps `App` next to `WorkspaceProvider`. |

### Deleted

- `src/components/chat/ChatPanel.tsx` (dedicated AI panel) — replaced by `TeamChatPanel` + AI DM + `/ai`.

### Modified

| File | Change |
|------|--------|
| `src/components/layout/Shell.tsx` | Drop `<ChatPanel />`, mount `<TeamChatPanel />`. Keep right panel persistent (no tab logic). |
| `src/components/explorer/Explorer.tsx` | Task row click → `chatCtx.setActiveTaskThread(task)`. |
| `src/contexts/WorkspaceContext.tsx` | Unchanged interface (selectedModel still used as `/ai` default). |
| `src/design/tokens.ts` | Add `chatTokens` namespace for the dark+lavender values. |
| `src/index.css` | Add `[data-skin="chat-dark"]` block with CSS vars + load Inter weights. |
| `database_setup.sql` | Append all new tables, RLS policies, RPCs, AI bot seed, storage bucket setup. |
| `backend/routers/ai_chat.py` | `/chat` accepts `context_type`, `context_id`, `recent_messages`; on success, inserts AI reply row via service role with `author_id=BOT_USER_ID`, `command='ai'`, `replies_to=<invoker_message_id>`, `model_id=<model>`. |

---

## 7. Realtime, Presence, RBAC

### Realtime

- One subscription per active context (`messages` INSERT/UPDATE filtered by `context_type` + `context_id`).
- One subscription per active context on `message_reactions` (event `*`).
- Global subscription on `message_mentions` filtered by `mentioned_user_id = currentUserId` → drives unread bumps + toasts.

### Presence

- One Supabase presence channel per project: `presence:{projectId}`.
- Each client tracks `{ user_id, online_at }` on subscribe.
- Online dots in ContextList + ContextHeader derived from presence state.
- Ephemeral — not persisted.

### RBAC matrix

| Action | Who |
|--------|-----|
| Read channels (this project) | any project member |
| Post in channel | any project member |
| Create channel | ADMIN |
| Archive channel | ADMIN or creator |
| Read DM | only the two parties |
| Send DM | any project member ↔ any project member |
| Read AI DM | owner only |
| Read task thread | any project member (open policy) |
| React | any project member with read access |
| Edit own message | author, within 15 min |
| Delete own message | author |
| Delete any message | ADMIN |
| `/ai` | any project member |
| Upload attachment | any project member, ≤10 MB |

### RLS policies (appended to `database_setup.sql`)

```sql
ALTER TABLE channels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_state           ENABLE ROW LEVEL SECURITY;

-- Project member check (open-project model — swap to project_members lookup when multi-project ships).
CREATE OR REPLACE FUNCTION is_project_member(p_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$;

-- Task → project lookup that bypasses tasks RLS (needed for task-thread visibility,
-- which is broader than task visibility itself).
CREATE OR REPLACE FUNCTION task_project_id(p_task uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT project_id FROM tasks WHERE id = p_task;
$$;

-- channels
CREATE POLICY "channels_select" ON channels FOR SELECT
  USING (is_project_member(project_id));
CREATE POLICY "channels_insert" ON channels FOR INSERT
  WITH CHECK (is_admin() AND is_project_member(project_id));
CREATE POLICY "channels_update" ON channels FOR UPDATE
  USING (is_admin() OR created_by = auth.uid());

-- dm_threads
CREATE POLICY "dm_threads_select" ON dm_threads FOR SELECT
  USING (auth.uid() IN (user_a_id, user_b_id));
CREATE POLICY "dm_threads_insert" ON dm_threads FOR INSERT
  WITH CHECK (auth.uid() IN (user_a_id, user_b_id));

-- messages
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  CASE context_type
    WHEN 'channel' THEN EXISTS (
      SELECT 1 FROM channels c WHERE c.id = messages.context_id AND is_project_member(c.project_id)
    )
    WHEN 'dm' THEN EXISTS (
      SELECT 1 FROM dm_threads d WHERE d.id = messages.context_id AND auth.uid() IN (d.user_a_id, d.user_b_id)
    )
    WHEN 'task' THEN is_project_member(task_project_id(messages.context_id))
  END
);
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (author_id = auth.uid());
  -- AI bot inserts are server-side via service role → bypasses RLS.
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  USING (author_id = auth.uid() AND created_at > NOW() - INTERVAL '15 minutes');
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  USING (author_id = auth.uid() OR is_admin());

-- reactions
CREATE POLICY "reactions_select" ON message_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- mentions
CREATE POLICY "mentions_select" ON message_mentions FOR SELECT
  USING (mentioned_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM messages m WHERE m.id = message_mentions.message_id AND m.author_id = auth.uid()));
CREATE POLICY "mentions_insert" ON message_mentions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.author_id = auth.uid()));

-- attachments
CREATE POLICY "attachments_select" ON message_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_attachments.message_id));
CREATE POLICY "attachments_insert" ON message_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.author_id = auth.uid()));

-- read_state
CREATE POLICY "read_state_all" ON read_state FOR ALL USING (user_id = auth.uid());
```

### Storage bucket

```
Bucket:  chat-attachments (private)
Path:    {project_id}/{message_id}/{filename}
RLS on storage.objects:
  SELECT: project member
  INSERT: project member, size_bytes ≤ 10*1024*1024, mime_type in (image/*, application/pdf, text/*)
  DELETE: uploader or admin
```

Frontend flow: request signed upload URL → upload → INSERT `message_attachments` row → render via signed download URL (cached 1h).

---

## 8. Notifications & Unread

### Unread RPC

```sql
-- SECURITY DEFINER: bypasses tasks RLS so task-thread unread counts work
-- regardless of which tasks the caller can see (chat policy is broader than task policy).
CREATE OR REPLACE FUNCTION get_unread_summary(p_user uuid, p_project uuid)
RETURNS TABLE (context_type text, context_id uuid, unread int, mentions int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ctxs AS (
    SELECT 'channel'::text AS ctype, c.id AS cid
      FROM channels c WHERE c.project_id = p_project AND NOT c.archived
    UNION ALL
    SELECT 'dm'::text, d.id
      FROM dm_threads d WHERE p_user IN (d.user_a_id, d.user_b_id)
    UNION ALL
    SELECT 'task'::text, t.id
      FROM tasks t WHERE t.project_id = p_project
  )
  SELECT ctxs.ctype, ctxs.cid,
    COUNT(m.id)::int AS unread,
    COUNT(mm.message_id)::int AS mentions
  FROM ctxs
  LEFT JOIN read_state rs
    ON rs.user_id = p_user AND rs.context_type = ctxs.ctype AND rs.context_id = ctxs.cid
  LEFT JOIN messages m
    ON m.context_type = ctxs.ctype AND m.context_id = ctxs.cid
    AND m.created_at > COALESCE(rs.last_read_at, 'epoch')
    AND m.author_id <> p_user
  LEFT JOIN message_mentions mm
    ON mm.message_id = m.id AND mm.mentioned_user_id = p_user
  GROUP BY ctxs.ctype, ctxs.cid;
$$;
```

### Update flow

- New message INSERT (realtime) → bump local unread map for that context if not active.
- User opens context → `UPSERT read_state SET last_read_at = NOW()` → clear local count.
- Switching contexts marks the leaving one read.

### Visuals

```
ContextList row:
  ● 3       lavender pill with count   — mention count > 0
  ●         small lavender dot         — unread, no mention
  (none)    caught up

Activity bar Chat icon:
  total mentions across contexts → lavender pill bottom-right of icon
  if zero mentions but any unread → dim dot
```

### Toasts

Use existing `ToastProvider` (`src/components/ui/Toast.tsx`):
- Trigger: realtime INSERT lands, context is not active, AND the message mentions me.
- Body: `"@Sarah: hey can you review…"` (truncate 80 chars).
- Click toast → switch active context to the source.
- Tone: `info`, duration `5000ms`.

AI replies in shared channels do **not** toast the invoker (they asked).

Email/push: out of scope.

### Guest mode

- Demo seeded: 1 channel `#general` with 4 messages, 2 demo DMs, 1 task thread.
- No realtime, no writes — pure UI showcase.
- Unread map hardcoded `{ general: 2, "ai-dm": 1 }` so badges appear.

---

## 9. AI Integration

### Invocation flow

```
User types: /ai how should we structure auth?
  → MessageComposer parses leading "/ai " → command='ai'
  → INSERT user message (context_type, context_id, body, command='ai')
  → fetch POST /api/ai/chat {
      context_type, context_id,
      user_message,
      recent_messages: last 20 from this context,
      model_id, provider,
      api_keys                            // localStorage, transient
    }
  → Backend resolve_key()  (user key > server env, unchanged priority)
  → Backend builds prompt: system + recent_messages + RAG matches + user_message
  → Backend calls call_anthropic | call_openai | call_google
  → Backend INSERT AI reply (author_id=BOT_USER_ID, body=response, command='ai',
      replies_to=<user_message.id>, model_id) via service role
  → Realtime broadcasts → all readers see invocation + reply
  → Response { ok, message_id } returned to invoker (used only for error display)
```

### Two AI contexts

- **Shared (channel / DM / task)** — `/ai` invocation + reply are visible to everyone with read access. Each invoker pays with their own key.
- **Private AI DM** — auto-created `dm_threads` row with `user_b_id = BOT_USER_ID` on first login. Only that user sees it. Replaces the old dedicated AI ChatPanel.

### Bot rendering

- `MessageItem` detects `author.is_bot === true` → applies lavender left border, shows model badge (`Claude Sonnet 4.6`, etc.), uses `🤖` avatar.
- No edit/delete for bot messages from frontend.

### Security

- `BOT_USER_ID` is a hardcoded constant (`src/lib/supabaseClient.ts` + backend `BOT_USER_ID` env / constant).
- Backend validates: invoker is authenticated + project member, context_id exists & invoker has access, body length, recent_messages length cap (~50).
- API keys never persisted, never logged. Existing `resolve_key()` priority unchanged.

---

## 10. Phased Rollout (within this spec)

No feature flag — three internal phases gated by merge order. Each phase deployable on its own.

**Phase 1 — Skeleton + Channels (Day 1–2)**
- DB: `channels`, `messages`, `read_state` + RLS.
- Seed AI bot profile row.
- `TeamChatPanel` + `ContextList` + `MessageList` + `MessageComposer` (plain text only).
- Channel CRUD (admin creates, members post).
- Realtime INSERT subscription.
- Delete `ChatPanel.tsx`; mount `TeamChatPanel`.
- Apply `data-skin="chat-dark"` scope + tokens + Inter font.

**Phase 2 — DMs + AI member (Day 2–3)**
- DB: `dm_threads` + RLS.
- Auto-create AI DM on first login.
- DM list section + "+ new dm" picker.
- `SlashCommandMenu` (only `/ai`).
- Backend `/api/ai/chat` accepts new fields, inserts bot reply.
- Bot styling in `MessageItem`.

**Phase 3 — Mentions + Reactions + Attachments + Task Threads (Day 3–5)**
- DB: `message_mentions`, `message_reactions`, `message_attachments` + RLS + storage bucket.
- `@` autocomplete; reactions bar + fixed-set picker; attachment upload via signed URL.
- `TaskThreadDrawer` mounts on Explorer task click.
- Unread RPC + activity bar badge + toast on mention.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Two visual systems (dark chat + cream rest) feels jarring. | Scope the dark skin tightly via `data-skin`. Whole-site redesign is the explicit next spec — short coexistence window. |
| AI cost — shared channel `/ai` could be spammed by one user. | Invoker pays via own key; backend rate-limits per user (e.g. 30/min) — implementation note for Phase 2. |
| Realtime subscription churn when switching contexts fast. | One subscription per active context, cleanly removed on context change. Mention sub is global and stable. |
| RLS performance on `messages_select` (CASE branch hits subqueries). | Index `idx_messages_ctx` on `(context_type, context_id, created_at desc)`. Channels/DMs/tasks lookups are point queries by id. Re-evaluate after Phase 1 load test. |
| Bot messages bypass RLS via service role — risk of bad inserts. | Backend validates invoker access before insert. Only the `/api/ai/chat` route can write as bot. No other code path. |
| Unread RPC scales linearly with channel/task count. | Acceptable at current single-project, ~10-channel, ~50-task scale. Re-evaluate when multi-project ships. |
| Whole-site redesign drift while this lives in two skins. | Ship the redesign spec immediately after Phase 3. Don't let the split linger. |

---

## 12. Open Questions / Deferred

- Whose "creator" gets `created_by` set on the seeded AI DM? → owner = current user, `user_b_id = BOT_USER_ID`. No `created_by` field on `dm_threads`; not needed.
- Should AI in a shared channel see prior `/ai` exchanges in that channel? → yes, `recent_messages` includes them (no filtering).
- Should bot messages count toward unread for the invoker? → no, bot replies in shared contexts skip toast for invoker; unread badge still increments to keep counts consistent for other readers.
- Markdown rendering — deferred. Plain text only in Phase 1–3.
- Reaction picker emoji set — deferred to UX iteration; fixed set ships in Phase 3.

---

## 13. Definition of Done

- All three phases merged.
- DB migrations applied to Supabase project.
- `ChatPanel.tsx` deleted; right panel mounts `TeamChatPanel`.
- AI DM auto-created for every logged-in user.
- `/ai` in any context produces a bot reply visible to all readers.
- Mentions trigger toast + activity bar badge.
- Reactions add/remove in realtime.
- Attachments upload, render inline images, download other types.
- Task thread drawer opens on Explorer task click and posts thread messages.
- RBAC: members can't read another DM, can't create channels, can't post as bot.
- Guest mode shows seeded demo with no realtime writes.
- `npm run build` clean, no TS errors.

---
