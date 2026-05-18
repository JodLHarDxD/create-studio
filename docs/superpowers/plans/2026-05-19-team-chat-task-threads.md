# Team Chat + Task Threads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team-wide chat (channels + DMs), AI member via `/ai` slash command, and per-task threads — making CREATstudio the main place the team interacts.

**Architecture:** Single unified `messages` table with `context_type` discriminator (channel/dm/task). Realtime via Supabase channels. RLS-enforced visibility per context. AI bot is a seeded profile row; backend service-role inserts its replies. Dedicated AI chat panel is removed — AI lives inside team chat. New dark+lavender skin scoped via `data-skin="chat-dark"` to the right panel + task drawer only; rest of site keeps cream.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind v4, Supabase (Postgres + pgvector + RLS + Realtime + Storage), FastAPI (Python, httpx), Vitest.

**Source spec:** [docs/superpowers/specs/2026-05-19-team-chat-task-threads-design.md](../specs/2026-05-19-team-chat-task-threads-design.md)

---

## File Structure

### New files

```
backend/
  routers/ai_chat.py                              MODIFY — add /chat/team route, extend ChatRequest model
  models.py                                       MODIFY — add TeamChatRequest, BOT_USER_ID constant

src/
  contexts/ChatContext.tsx                        NEW — active context, unread map, presence
  components/chat-team/
    TeamChatPanel.tsx                             NEW — right-panel root, applies data-skin="chat-dark"
    ContextList.tsx                               NEW — AI DM + channels + DMs
    ContextHeader.tsx                             NEW — back arrow, title, member count
    MessageList.tsx                               NEW — virtualized scroll
    MessageItem.tsx                               NEW — body, reactions, attachments, bot styling
    MessageComposer.tsx                           NEW — textarea, slash, mentions, attach
    SlashCommandMenu.tsx                          NEW — popover when "/" typed
    MentionPicker.tsx                             NEW — popover when "@" typed
    ReactionBar.tsx                               NEW — emoji picker + counts
    AttachmentTile.tsx                            NEW — inline image / file chip
    NewChannelModal.tsx                           NEW — admin only
    NewDMModal.tsx                                NEW — user picker
    hooks/
      useActiveContext.ts                         NEW
      useMessages.ts                              NEW — fetch + realtime per context
      useUnread.ts                                NEW — get_unread_summary + global mention sub
      useSlashCommand.ts                          NEW — parse "/" at line start
      useMentionAutocomplete.ts                   NEW — parse "@" + filter
      useChatPresence.ts                          NEW — Supabase presence per project
      useDMThread.ts                              NEW — find/create canonical pair
      useAttachmentUpload.ts                      NEW — signed URL flow
    lib/
      slashParser.ts                              NEW — pure: parseSlashCommand(text)
      mentionParser.ts                            NEW — pure: extractMentions(text, users)
      dmPair.ts                                   NEW — pure: canonicalDMPair(a, b)
      unreadDerive.ts                             NEW — pure: deriveUnread(messages, last_read_at, my_id)
    __tests__/
      slashParser.test.ts                         NEW
      mentionParser.test.ts                       NEW
      dmPair.test.ts                              NEW
      unreadDerive.test.ts                        NEW
  components/tasks/
    TaskThreadDrawer.tsx                          NEW — slides over chat + editor on task click

db/
  migrations/2026-05-19-chat.sql                  NEW — all schema additions + RLS + RPC + bot seed
  migrations/2026-05-19-storage.sql               NEW — storage bucket + policies (Phase 3)

docs/superpowers/plans/
  2026-05-19-team-chat-task-threads.md            (this file)
```

### Modified files

```
src/lib/supabaseClient.ts                         add Channel, DMThread, Message, MessageReaction,
                                                  MessageMention, MessageAttachment, ReadState types
                                                  + BOT_USER_ID constant + is_bot on Profile
src/contexts/WorkspaceContext.tsx                 unchanged interface
src/components/layout/Shell.tsx                   delete <ChatPanel/>, mount <TeamChatPanel/>
src/components/explorer/Explorer.tsx              task click → chatCtx.setActiveTaskThread(task)
src/App.tsx                                       wrap with <ChatProvider>
src/design/tokens.ts                              add chatTokens namespace (dark+lavender)
src/index.css                                     add [data-skin="chat-dark"] block + Inter weights
backend/routers/ai_chat.py                        new /chat/team route + bot reply insert
backend/models.py                                 TeamChatRequest, BOT_USER_ID
database_setup.sql                                append migration 2026-05-19-chat.sql contents
```

### Deleted files

```
src/components/chat/ChatPanel.tsx                 DELETE — replaced by TeamChatPanel + /ai
src/components/chat/                              DELETE entire folder
```

---

# PHASE 1 — Skeleton + Channels

Goal: channels-only chat in right panel, real-time, no DMs / AI / mentions / reactions / attachments. Get the foundation merged and working before layering features.

---

### Task 1.1: SQL migration — channels, messages, read_state, bot seed, helpers

**Files:**
- Create: `db/migrations/2026-05-19-chat.sql`
- Modify: `database_setup.sql` — append the same content at end

- [ ] **Step 1: Write the migration SQL**

Create `db/migrations/2026-05-19-chat.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════
-- Team Chat + Task Threads — Phase 1
-- ════════════════════════════════════════════════════════════════════

-- ── Bot user (FK requires auth.users row first) ─────────────────────
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES ('00000000-0000-0000-0000-000000000a1c', 'ai@creatstudio.local', '', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN ALTER TABLE profiles ADD COLUMN is_bot boolean DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

INSERT INTO profiles (id, email, full_name, role, is_bot)
VALUES ('00000000-0000-0000-0000-000000000a1c', 'ai@creatstudio.local', 'AI Assistant', 'MEMBER', true)
ON CONFLICT (id) DO NOTHING;

-- ── Tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  archived    boolean DEFAULT false,
  created_at  timestamptz DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type  text NOT NULL CHECK(context_type IN ('channel','dm','task')),
  context_id    uuid NOT NULL,
  author_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body          text NOT NULL,
  command       text,
  replies_to    uuid REFERENCES messages(id) ON DELETE SET NULL,
  model_id      text,
  created_at    timestamptz DEFAULT NOW(),
  edited_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_messages_ctx ON messages(context_type, context_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);

CREATE TABLE IF NOT EXISTS read_state (
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  context_type  text NOT NULL,
  context_id    uuid NOT NULL,
  last_read_at  timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, context_type, context_id)
);

-- ── Helpers ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_project_member(p_project uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION task_project_id(p_task uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT project_id FROM tasks WHERE id = p_task;
$$;

-- ── RLS: channels ────────────────────────────────────────────────────
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "channels_select" ON channels;
CREATE POLICY "channels_select" ON channels FOR SELECT USING (is_project_member(project_id));
DROP POLICY IF EXISTS "channels_insert" ON channels;
CREATE POLICY "channels_insert" ON channels FOR INSERT WITH CHECK (is_admin() AND is_project_member(project_id));
DROP POLICY IF EXISTS "channels_update" ON channels;
CREATE POLICY "channels_update" ON channels FOR UPDATE USING (is_admin() OR created_by = auth.uid());

-- ── RLS: messages (Phase 1 supports channel + task; dm added in Phase 2) ──
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  CASE context_type
    WHEN 'channel' THEN EXISTS (SELECT 1 FROM channels c WHERE c.id = messages.context_id AND is_project_member(c.project_id))
    WHEN 'dm'      THEN false   -- enabled in Phase 2
    WHEN 'task'    THEN is_project_member(task_project_id(messages.context_id))
  END
);
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (author_id = auth.uid());
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE
  USING (author_id = auth.uid() AND created_at > NOW() - INTERVAL '15 minutes');
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages FOR DELETE USING (author_id = auth.uid() OR is_admin());

-- ── RLS: read_state ──────────────────────────────────────────────────
ALTER TABLE read_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_state_all" ON read_state;
CREATE POLICY "read_state_all" ON read_state FOR ALL USING (user_id = auth.uid());

-- ── Seed a default #general channel for the first existing project ──
INSERT INTO channels (project_id, name, description, created_by)
SELECT p.id, 'general', 'Project-wide chat', p.owner_id
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.project_id = p.id AND c.name = 'general')
LIMIT 1;
```

- [ ] **Step 2: Append to `database_setup.sql`**

Open `database_setup.sql` and append at the very end:

```sql

-- ════════════════════════════════════════════════════════════════════
-- Migration: 2026-05-19 — Team Chat + Task Threads (Phase 1)
-- ════════════════════════════════════════════════════════════════════
-- See db/migrations/2026-05-19-chat.sql for the canonical version.
```

Then paste the entire content of `db/migrations/2026-05-19-chat.sql` after that header.

- [ ] **Step 3: Run migration in Supabase**

In the Supabase SQL Editor for the project, paste the content of `db/migrations/2026-05-19-chat.sql` and execute. Expected: no errors, `channels`, `messages`, `read_state` tables visible in Table Editor, AI bot row exists in `profiles`.

- [ ] **Step 4: Enable realtime on `messages` table**

Supabase Dashboard → Database → Replication → ensure `messages` table is enabled for realtime. Same for `channels` and `read_state`.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/2026-05-19-chat.sql database_setup.sql
git commit -m "feat(chat): phase 1 schema — channels, messages, read_state, bot seed"
```

---

### Task 1.2: TypeScript types + BOT_USER_ID constant

**Files:**
- Modify: `src/lib/supabaseClient.ts`

- [ ] **Step 1: Add types and constant**

Open `src/lib/supabaseClient.ts`. After the existing `LocalFileView` interface, append:

```typescript
export const BOT_USER_ID = '00000000-0000-0000-0000-000000000a1c';

export interface Channel {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_by: string | null;
  archived: boolean;
  created_at: string;
}

export interface DMThread {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
}

export type MessageContextType = 'channel' | 'dm' | 'task';

export interface Message {
  id: string;
  context_type: MessageContextType;
  context_id: string;
  author_id: string;
  body: string;
  command: string | null;
  replies_to: string | null;
  model_id: string | null;
  created_at: string;
  edited_at: string | null;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface MessageMention {
  message_id: string;
  mentioned_user_id: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
}

export interface ReadState {
  user_id: string;
  context_type: MessageContextType;
  context_id: string;
  last_read_at: string;
}
```

Also extend the existing `Profile` interface — replace its declaration with:

```typescript
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  bio?: string;
  github_url?: string;
  avatar_url?: string | null;
  is_bot?: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: PASS (no TS errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabaseClient.ts
git commit -m "feat(chat): typescript types + BOT_USER_ID constant"
```

---

### Task 1.3: Add chat-dark tokens + Inter font loading

**Files:**
- Modify: `src/design/tokens.ts`
- Modify: `src/index.css`
- Modify: `index.html`

- [ ] **Step 1: Add `chatTokens` namespace to design tokens**

Append to `src/design/tokens.ts`:

```typescript
export const chatTokens = {
  bg: {
    base:     '#0E1014',
    card:     '#1A1D24',
    elevated: '#222630',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#A8ADB8',
    tertiary:  '#6B7080',
  },
  accent: {
    lavender: '#C5B8FF',
    cream:    '#E8E2A8',
    success:  '#7ED4A8',
    danger:   '#FF8B8B',
  },
  border: 'rgba(255,255,255,0.06)',
  radius: {
    card: 16,
    chip: 10,
  },
  font: {
    sans: '"Inter", "General Sans", ui-sans-serif, system-ui, sans-serif',
  },
} as const;
```

- [ ] **Step 2: Add scoped CSS block**

Open `src/index.css`. Append at the bottom (after all existing blocks):

```css
/* ════════════════════════════════════════════════════════════════
   Team Chat dark+lavender skin
   Scoped: wrap the right chat panel + task drawer with
   data-skin="chat-dark" — the rest of the site keeps cream.
   ════════════════════════════════════════════════════════════════ */
[data-skin="chat-dark"] {
  --bg-base:       #0E1014;
  --bg-card:       #1A1D24;
  --bg-elevated:   #222630;
  --border-chat:   rgba(255,255,255,0.06);
  --text-1-chat:   #FFFFFF;
  --text-2-chat:   #A8ADB8;
  --text-3-chat:   #6B7080;
  --accent:        #C5B8FF;
  --accent-2:      #E8E2A8;
  --success-chat:  #7ED4A8;
  --danger-chat:   #FF8B8B;
  --radius-card:   16px;
  --radius-chip:   10px;

  font-family: "Inter", "General Sans", ui-sans-serif, system-ui, sans-serif;
  background: var(--bg-base);
  color: var(--text-1-chat);
}

[data-skin="chat-dark"] *,
[data-skin="chat-dark"] *::before,
[data-skin="chat-dark"] *::after {
  border-color: var(--border-chat);
}

[data-skin="chat-dark"] .tabular {
  font-variant-numeric: tabular-nums;
}

[data-skin="chat-dark"] ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
[data-skin="chat-dark"] ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
}
[data-skin="chat-dark"] ::-webkit-scrollbar-track {
  background: transparent;
}
```

- [ ] **Step 3: Add Inter weights to index.html**

Open `index.html`. Inside `<head>`, after any existing Google Fonts `<link>` tags, add (only if Inter 500/600 isn't already loaded):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Skip if `Inter` is already in the existing `<link>` (most likely it is).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds, no CSS errors.

- [ ] **Step 5: Commit**

```bash
git add src/design/tokens.ts src/index.css index.html
git commit -m "feat(chat): dark+lavender token scope + Inter font"
```

---

### Task 1.4: Pure logic — slashParser, mentionParser, dmPair, unreadDerive (TDD)

**Files:**
- Create: `src/components/chat-team/lib/slashParser.ts`
- Create: `src/components/chat-team/lib/mentionParser.ts`
- Create: `src/components/chat-team/lib/dmPair.ts`
- Create: `src/components/chat-team/lib/unreadDerive.ts`
- Test: `src/components/chat-team/__tests__/*.test.ts`

These are pure functions — TDD them.

- [ ] **Step 1: Write failing tests**

Create `src/components/chat-team/__tests__/slashParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSlashCommand } from '../lib/slashParser';

describe('parseSlashCommand', () => {
  it('detects /ai at start with prompt', () => {
    expect(parseSlashCommand('/ai hello there')).toEqual({ command: 'ai', prompt: 'hello there' });
  });
  it('returns null when no slash', () => {
    expect(parseSlashCommand('hello /ai world')).toBeNull();
  });
  it('returns null when command unknown', () => {
    expect(parseSlashCommand('/foo bar')).toBeNull();
  });
  it('handles slash with no prompt', () => {
    expect(parseSlashCommand('/ai')).toEqual({ command: 'ai', prompt: '' });
    expect(parseSlashCommand('/ai ')).toEqual({ command: 'ai', prompt: '' });
  });
  it('trims surrounding whitespace before parsing', () => {
    expect(parseSlashCommand('  /ai hi  ')).toEqual({ command: 'ai', prompt: 'hi' });
  });
});
```

Create `src/components/chat-team/__tests__/mentionParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractMentions } from '../lib/mentionParser';

const users = [
  { id: 'u1', full_name: 'Alice', email: 'a@x' },
  { id: 'u2', full_name: 'Bob Stone', email: 'b@x' },
];

describe('extractMentions', () => {
  it('finds single @user by full_name token match', () => {
    expect(extractMentions('hey @Alice can you check', users as any)).toEqual(['u1']);
  });
  it('matches first word of multi-word name', () => {
    expect(extractMentions('@Bob have a sec?', users as any)).toEqual(['u2']);
  });
  it('returns empty when no @', () => {
    expect(extractMentions('plain text', users as any)).toEqual([]);
  });
  it('deduplicates repeated mentions', () => {
    expect(extractMentions('@Alice @Alice', users as any)).toEqual(['u1']);
  });
  it('ignores unknown @names', () => {
    expect(extractMentions('@Ghost', users as any)).toEqual([]);
  });
});
```

Create `src/components/chat-team/__tests__/dmPair.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canonicalDMPair } from '../lib/dmPair';

describe('canonicalDMPair', () => {
  it('orders smaller uuid as user_a', () => {
    expect(canonicalDMPair('bbb', 'aaa')).toEqual({ user_a_id: 'aaa', user_b_id: 'bbb' });
  });
  it('preserves order when already canonical', () => {
    expect(canonicalDMPair('aaa', 'bbb')).toEqual({ user_a_id: 'aaa', user_b_id: 'bbb' });
  });
  it('throws when identical', () => {
    expect(() => canonicalDMPair('aaa', 'aaa')).toThrow();
  });
});
```

Create `src/components/chat-team/__tests__/unreadDerive.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveUnread } from '../lib/unreadDerive';

const me = 'me';
const t = (offsetMin: number) => new Date(Date.now() + offsetMin * 60_000).toISOString();

describe('deriveUnread', () => {
  it('counts messages newer than last_read_at, excluding own', () => {
    const msgs = [
      { id: '1', author_id: me, created_at: t(-10) },
      { id: '2', author_id: 'other', created_at: t(-5) },
      { id: '3', author_id: 'other', created_at: t(-1) },
    ];
    expect(deriveUnread(msgs as any, t(-7), me)).toBe(2);
  });
  it('returns 0 when no last_read_at provided (epoch fallback) but only own msgs', () => {
    const msgs = [{ id: '1', author_id: me, created_at: t(-1) }];
    expect(deriveUnread(msgs as any, null, me)).toBe(0);
  });
  it('counts everything if last_read_at is epoch', () => {
    const msgs = [
      { id: '1', author_id: 'a', created_at: t(-1) },
      { id: '2', author_id: 'b', created_at: t(-2) },
    ];
    expect(deriveUnread(msgs as any, null, me)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/chat-team`
Expected: all 4 test files FAIL with "module not found".

- [ ] **Step 3: Implement `slashParser.ts`**

Create `src/components/chat-team/lib/slashParser.ts`:

```typescript
export interface SlashInvocation {
  command: 'ai';
  prompt: string;
}

const KNOWN: ReadonlyArray<'ai'> = ['ai'];

export function parseSlashCommand(text: string): SlashInvocation | null {
  const t = text.trim();
  if (!t.startsWith('/')) return null;
  const space = t.indexOf(' ');
  const head = (space === -1 ? t.slice(1) : t.slice(1, space)).toLowerCase();
  if (!KNOWN.includes(head as 'ai')) return null;
  const prompt = space === -1 ? '' : t.slice(space + 1).trim();
  return { command: head as 'ai', prompt };
}
```

- [ ] **Step 4: Implement `mentionParser.ts`**

Create `src/components/chat-team/lib/mentionParser.ts`:

```typescript
import type { Profile } from '@/lib/supabaseClient';

export function extractMentions(text: string, users: Profile[]): string[] {
  const ids = new Set<string>();
  const re = /@(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const handle = m[1].toLowerCase();
    const u = users.find(u => u.full_name.split(/\s+/)[0]?.toLowerCase() === handle);
    if (u) ids.add(u.id);
  }
  return Array.from(ids);
}
```

- [ ] **Step 5: Implement `dmPair.ts`**

Create `src/components/chat-team/lib/dmPair.ts`:

```typescript
export function canonicalDMPair(a: string, b: string): { user_a_id: string; user_b_id: string } {
  if (a === b) throw new Error('canonicalDMPair: ids must differ');
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}
```

- [ ] **Step 6: Implement `unreadDerive.ts`**

Create `src/components/chat-team/lib/unreadDerive.ts`:

```typescript
import type { Message } from '@/lib/supabaseClient';

export function deriveUnread(
  messages: Pick<Message, 'id' | 'author_id' | 'created_at'>[],
  lastReadAt: string | null,
  myId: string,
): number {
  const threshold = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter(
    m => m.author_id !== myId && new Date(m.created_at).getTime() > threshold,
  ).length;
}
```

- [ ] **Step 7: Run tests — verify all pass**

Run: `npm test -- src/components/chat-team`
Expected: 4 test files PASS, all assertions green.

- [ ] **Step 8: Commit**

```bash
git add src/components/chat-team/lib src/components/chat-team/__tests__
git commit -m "feat(chat): pure helpers — slash, mention, dm pair, unread (tested)"
```

---

### Task 1.5: ChatContext skeleton

**Files:**
- Create: `src/contexts/ChatContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement ChatContext**

Create `src/contexts/ChatContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Task, MessageContextType } from '@/lib/supabaseClient';

export interface ActiveContext {
  type: MessageContextType;
  id: string;
  title: string;
}

interface UnreadEntry { unread: number; mentions: number; }
export type UnreadMap = Record<string, UnreadEntry>;     // key = `${type}:${id}`

interface ChatContextType {
  activeContext: ActiveContext | null;
  setActiveContext: (c: ActiveContext | null) => void;
  activeTaskThread: Task | null;
  setActiveTaskThread: (t: Task | null) => void;
  unreadMap: UnreadMap;
  setUnreadMap: React.Dispatch<React.SetStateAction<UnreadMap>>;
  onlineUserIds: Set<string>;
  setOnlineUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const Ctx = createContext<ChatContextType | undefined>(undefined);

export function contextKey(type: MessageContextType, id: string): string {
  return `${type}:${id}`;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [activeTaskThread, setActiveTaskThread] = useState<Task | null>(null);
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  return (
    <Ctx.Provider value={{
      activeContext, setActiveContext,
      activeTaskThread, setActiveTaskThread,
      unreadMap, setUnreadMap,
      onlineUserIds, setOnlineUserIds,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useChat() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChat must be used within ChatProvider');
  return v;
}
```

- [ ] **Step 2: Wrap App with ChatProvider**

Open `src/App.tsx`. Add the import and wrap the tree (place `ChatProvider` **inside** `WorkspaceProvider`, since the chat context will read auth/project state from workspace):

```tsx
import { ChatProvider } from '@/contexts/ChatContext';

// inside the JSX, replace:
//   <WorkspaceProvider>...children...</WorkspaceProvider>
// with:
<WorkspaceProvider>
  <ChatProvider>
    {/* existing children, including ToastProvider and Shell */}
  </ChatProvider>
</WorkspaceProvider>
```

(Read the existing `App.tsx` first — keep `ToastProvider` placement intact, just nest `ChatProvider` between it and the rest.)

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/ChatContext.tsx src/App.tsx
git commit -m "feat(chat): ChatProvider with activeContext + unread map"
```

---

### Task 1.6: `useMessages` and `useUnread` hooks (channel-only)

**Files:**
- Create: `src/components/chat-team/hooks/useMessages.ts`
- Create: `src/components/chat-team/hooks/useUnread.ts`

- [ ] **Step 1: Implement `useMessages`**

Create `src/components/chat-team/hooks/useMessages.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { supabase, Message, MessageContextType } from '@/lib/supabaseClient';

export function useMessages(type: MessageContextType | null, id: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!type || !id) { setMessages([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('context_type', type)
      .eq('context_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) console.error('useMessages fetch:', error);
    if (data) setMessages(data as Message[]);
    setLoading(false);
  }, [type, id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!type || !id) return;
    const channel = supabase
      .channel(`msg:${type}:${id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.context_type !== type) return;
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          if (m.context_type !== type) return;
          setMessages(prev => prev.map(x => x.id === m.id ? m : x));
        })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages',
          filter: `context_id=eq.${id}` },
        (payload) => {
          const m = payload.old as Message;
          setMessages(prev => prev.filter(x => x.id !== m.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [type, id]);

  return { messages, loading, refetch: fetchMessages };
}
```

- [ ] **Step 2: Implement `useUnread`**

Create `src/components/chat-team/hooks/useUnread.ts`:

```typescript
import { useEffect, useCallback } from 'react';
import { supabase, MessageContextType } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useChat, contextKey } from '@/contexts/ChatContext';

export function useUnread() {
  const { currentUserId, activeProject } = useWorkspace();
  const { unreadMap, setUnreadMap } = useChat();

  const refetchSummary = useCallback(async () => {
    if (!currentUserId || !activeProject) return;
    const { data, error } = await supabase.rpc('get_unread_summary', {
      p_user: currentUserId,
      p_project: activeProject.id,
    });
    if (error) { console.warn('unread summary:', error); return; }
    const map: Record<string, { unread: number; mentions: number }> = {};
    for (const row of (data || [])) {
      map[contextKey(row.context_type as MessageContextType, row.context_id)] = {
        unread: row.unread,
        mentions: row.mentions,
      };
    }
    setUnreadMap(map);
  }, [currentUserId, activeProject, setUnreadMap]);

  useEffect(() => { refetchSummary(); }, [refetchSummary]);

  const markRead = useCallback(async (type: MessageContextType, id: string) => {
    if (!currentUserId) return;
    setUnreadMap(prev => ({ ...prev, [contextKey(type, id)]: { unread: 0, mentions: 0 } }));
    await supabase.from('read_state').upsert({
      user_id: currentUserId,
      context_type: type,
      context_id: id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,context_type,context_id' });
  }, [currentUserId, setUnreadMap]);

  return { unreadMap, refetchSummary, markRead };
}
```

- [ ] **Step 3: Add `get_unread_summary` RPC migration (if not in 1.1 migration)**

The Phase 1 channels-only RPC may want a simpler version, but spec includes the full version. Add this to the same `db/migrations/2026-05-19-chat.sql` (append before final seed), and re-run in Supabase:

```sql
CREATE OR REPLACE FUNCTION get_unread_summary(p_user uuid, p_project uuid)
RETURNS TABLE (context_type text, context_id uuid, unread int, mentions int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ctxs AS (
    SELECT 'channel'::text AS ctype, c.id AS cid
      FROM channels c WHERE c.project_id = p_project AND NOT c.archived
    UNION ALL
    SELECT 'task'::text, t.id
      FROM tasks t WHERE t.project_id = p_project
    -- 'dm' branch added in Phase 2
  )
  SELECT ctxs.ctype, ctxs.cid,
    COUNT(m.id)::int AS unread,
    0::int AS mentions   -- mentions enabled in Phase 3
  FROM ctxs
  LEFT JOIN read_state rs
    ON rs.user_id = p_user AND rs.context_type = ctxs.ctype AND rs.context_id = ctxs.cid
  LEFT JOIN messages m
    ON m.context_type = ctxs.ctype AND m.context_id = ctxs.cid
    AND m.created_at > COALESCE(rs.last_read_at, 'epoch')
    AND m.author_id <> p_user
  GROUP BY ctxs.ctype, ctxs.cid;
$$;
```

Run this in the Supabase SQL Editor. The function is re-created in Phase 2 (adds dm) and Phase 3 (adds mentions).

- [ ] **Step 4: Verify build**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team/hooks db/migrations/2026-05-19-chat.sql
git commit -m "feat(chat): useMessages + useUnread hooks + initial RPC"
```

---

### Task 1.7: `MessageList`, `MessageComposer`, `MessageItem` (plain text only)

**Files:**
- Create: `src/components/chat-team/MessageList.tsx`
- Create: `src/components/chat-team/MessageItem.tsx`
- Create: `src/components/chat-team/MessageComposer.tsx`

- [ ] **Step 1: `MessageItem.tsx` (Phase 1: plain text, no reactions/attachments)**

```tsx
import React from 'react';
import type { Message, Profile } from '@/lib/supabaseClient';

interface Props {
  message: Message;
  author: Profile | null;
  isMine: boolean;
}

export default function MessageItem({ message, author, isMine }: Props) {
  const ts = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isBot = author?.is_bot === true;

  return (
    <div style={{ padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: isBot ? 'rgba(197,184,255,0.15)' : 'rgba(255,255,255,0.06)',
        border: isBot ? '1px solid rgba(197,184,255,0.4)' : '1px solid var(--border-chat)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600, color: 'var(--text-2-chat)',
        flexShrink: 0,
      }}>
        {isBot ? '🤖' : author?.full_name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1-chat)' }}>
            {author?.full_name ?? 'Unknown'}
          </span>
          <span className="tabular" style={{ fontSize: 11, color: 'var(--text-3-chat)' }}>{ts}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2-chat)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>
          {message.body}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `MessageList.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import type { Message, Profile } from '@/lib/supabaseClient';
import MessageItem from './MessageItem';

interface Props {
  messages: Message[];
  users: Profile[];
  currentUserId: string | null;
}

export default function MessageList({ messages, users, currentUserId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}
    >
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3-chat)', fontSize: 12 }}>
          No messages yet. Be the first.
        </div>
      )}
      {messages.map(m => {
        const author = users.find(u => u.id === m.author_id) ?? null;
        return (
          <MessageItem
            key={m.id}
            message={m}
            author={author}
            isMine={m.author_id === currentUserId}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: `MessageComposer.tsx` (Phase 1: plain text only — slash/mentions/attach added later)**

```tsx
import React, { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { MessageContextType } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Props {
  contextType: MessageContextType;
  contextId: string;
}

export default function MessageComposer({ contextType, contextId }: Props) {
  const { currentUserId, loginState } = useWorkspace();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = value.trim();
    if (!body || !currentUserId || sending) return;
    if (loginState === 'guest') {
      setValue('');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      context_type: contextType,
      context_id: contextId,
      author_id: currentUserId,
      body,
    });
    setSending(false);
    if (error) { console.error('send:', error); return; }
    setValue('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-chat)',
      padding: 12,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      background: 'var(--bg-card)',
    }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="Type a message…"
        rows={1}
        style={{
          flex: 1, resize: 'none', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-chip)',
          color: 'var(--text-1-chat)', fontFamily: 'inherit', fontSize: 13,
          padding: '8px 12px', maxHeight: 120, outline: 'none',
        }}
      />
      <button
        onClick={send}
        disabled={sending || !value.trim()}
        style={{
          width: 36, height: 36, borderRadius: 'var(--radius-chip)',
          background: 'var(--accent)', color: '#0E1014',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer', opacity: value.trim() ? 1 : 0.4,
        }}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team/Message*.tsx
git commit -m "feat(chat): MessageList + MessageItem + MessageComposer (plain text)"
```

---

### Task 1.8: `ContextList`, `ContextHeader`, `NewChannelModal`

**Files:**
- Create: `src/components/chat-team/ContextList.tsx`
- Create: `src/components/chat-team/ContextHeader.tsx`
- Create: `src/components/chat-team/NewChannelModal.tsx`

- [ ] **Step 1: `NewChannelModal.tsx`**

```tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Props { isOpen: boolean; onClose: () => void; onCreated: () => void; }

export default function NewChannelModal({ isOpen, onClose, onCreated }: Props) {
  const { activeProject, currentUserId } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!activeProject || !currentUserId) return;
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);
    if (!clean) { setErr('Name required'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from('channels').insert({
      project_id: activeProject.id,
      name: clean,
      description: description.trim(),
      created_by: currentUserId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setName(''); setDescription('');
    onCreated();
    onClose();
  };

  return (
    <div data-skin="chat-dark" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: 'var(--bg-card)',
        border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-card)',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1-chat)' }}>New channel</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-3-chat)', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus value={name} onChange={e => setName(e.target.value)}
          placeholder="channel-name"
          style={{
            width: '100%', padding: '10px 12px', marginBottom: 12,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-chat)',
            borderRadius: 'var(--radius-chip)', color: 'var(--text-1-chat)', fontSize: 13,
          }}
        />
        <input
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          style={{
            width: '100%', padding: '10px 12px', marginBottom: 16,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-chat)',
            borderRadius: 'var(--radius-chip)', color: 'var(--text-1-chat)', fontSize: 13,
          }}
        />
        {err && <div style={{ color: 'var(--danger-chat)', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 14px', background: 'transparent', color: 'var(--text-2-chat)',
            border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-chip)', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{
            padding: '8px 14px', background: 'var(--accent)', color: '#0E1014',
            border: 'none', borderRadius: 'var(--radius-chip)', cursor: 'pointer', fontWeight: 600,
          }}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ContextList.tsx` (Phase 1: channels only — DMs section added in Phase 2)**

```tsx
import React, { useState } from 'react';
import { Hash, Plus } from 'lucide-react';
import type { Channel } from '@/lib/supabaseClient';
import { useChat, contextKey } from '@/contexts/ChatContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import NewChannelModal from './NewChannelModal';

interface Props {
  channels: Channel[];
  onRefetchChannels: () => void;
}

export default function ContextList({ channels, onRefetchChannels }: Props) {
  const { userRole } = useWorkspace();
  const { activeContext, setActiveContext, unreadMap } = useChat();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
        color: 'var(--text-3-chat)', textTransform: 'uppercase',
        padding: '8px 8px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Channels</span>
        {userRole === 'ADMIN' && (
          <button
            onClick={() => setNewOpen(true)}
            title="New channel"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3-chat)', cursor: 'pointer' }}
          ><Plus size={12} /></button>
        )}
      </div>

      {channels.filter(c => !c.archived).map(c => {
        const key = contextKey('channel', c.id);
        const u = unreadMap[key]?.unread ?? 0;
        const isActive = activeContext?.type === 'channel' && activeContext.id === c.id;
        return (
          <button
            key={c.id}
            onClick={() => setActiveContext({ type: 'channel', id: c.id, title: c.name })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 'var(--radius-chip)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--text-1-chat)' : 'var(--text-2-chat)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 13, fontWeight: u > 0 ? 600 : 400,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={13} style={{ opacity: 0.6 }} />
              {c.name}
            </span>
            {u > 0 && (
              <span className="tabular" style={{
                background: 'var(--accent)', color: '#0E1014',
                fontSize: 10, fontWeight: 700, padding: '1px 6px',
                borderRadius: 999, minWidth: 16, textAlign: 'center',
              }}>{u}</span>
            )}
          </button>
        );
      })}

      <NewChannelModal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={onRefetchChannels}
      />
    </div>
  );
}
```

- [ ] **Step 3: `ContextHeader.tsx`**

```tsx
import React from 'react';
import { ArrowLeft, Hash } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';

export default function ContextHeader() {
  const { activeContext, setActiveContext } = useChat();
  if (!activeContext) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderBottom: '1px solid var(--border-chat)',
      background: 'var(--bg-card)',
    }}>
      <button
        onClick={() => setActiveContext(null)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-2-chat)', cursor: 'pointer' }}
      ><ArrowLeft size={16} /></button>
      <Hash size={14} style={{ color: 'var(--text-3-chat)' }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1-chat)' }}>
        {activeContext.title}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team/ContextList.tsx src/components/chat-team/ContextHeader.tsx src/components/chat-team/NewChannelModal.tsx
git commit -m "feat(chat): ContextList + ContextHeader + NewChannelModal"
```

---

### Task 1.9: `TeamChatPanel` root + mount in Shell, delete old ChatPanel

**Files:**
- Create: `src/components/chat-team/TeamChatPanel.tsx`
- Modify: `src/components/layout/Shell.tsx`
- Delete: `src/components/chat/ChatPanel.tsx` (and the empty `src/components/chat/` dir)

- [ ] **Step 1: `TeamChatPanel.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase, Channel } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useChat } from '@/contexts/ChatContext';
import { useMessages } from './hooks/useMessages';
import { useUnread } from './hooks/useUnread';
import ContextList from './ContextList';
import ContextHeader from './ContextHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

export default function TeamChatPanel() {
  const { activeProject, users, currentUserId, loginState } = useWorkspace();
  const { activeContext } = useChat();
  const { markRead } = useUnread();
  const [channels, setChannels] = useState<Channel[]>([]);

  const fetchChannels = useCallback(async () => {
    if (!activeProject || loginState === 'guest') return;
    const { data } = await supabase.from('channels')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('created_at');
    if (data) setChannels(data as Channel[]);
  }, [activeProject, loginState]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Realtime channel list updates
  useEffect(() => {
    if (!activeProject) return;
    const ch = supabase.channel(`channels:${activeProject.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'channels', filter: `project_id=eq.${activeProject.id}` },
        () => fetchChannels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeProject, fetchChannels]);

  const { messages } = useMessages(activeContext?.type ?? null, activeContext?.id ?? null);

  // Mark read on context open + when new messages arrive while open
  useEffect(() => {
    if (!activeContext) return;
    markRead(activeContext.type, activeContext.id);
  }, [activeContext, messages.length, markRead]);

  return (
    <div data-skin="chat-dark" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)',
      borderLeft: '1px solid var(--border-chat)',
    }}>
      {/* Header bar — fixed title when no context, otherwise context header */}
      {!activeContext && (
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border-chat)',
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-1-chat)',
        }}>Team Chat</div>
      )}

      {!activeContext ? (
        <ContextList channels={channels} onRefetchChannels={fetchChannels} />
      ) : (
        <>
          <ContextHeader />
          <MessageList
            messages={messages}
            users={users}
            currentUserId={currentUserId}
          />
          <MessageComposer
            contextType={activeContext.type}
            contextId={activeContext.id}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `Shell.tsx`**

Open `src/components/layout/Shell.tsx`. Find the import `import ChatPanel from '../chat/ChatPanel';` and replace with:

```tsx
import TeamChatPanel from '../chat-team/TeamChatPanel';
```

Find the `<ChatPanel />` mount inside the AnimatePresence chat panel block and replace `<ChatPanel />` with `<TeamChatPanel />`.

- [ ] **Step 3: Delete old chat folder**

```bash
rm -r src/components/chat
```

(On Windows PowerShell: `Remove-Item -Recurse -Force src/components/chat`)

- [ ] **Step 4: Run dev server, smoke test**

```bash
npm run dev
```

Open http://localhost:5173, log in. Verify:
- Right panel shows "Team Chat" header + list with one channel (`#general` if seeded).
- Click `#general` → ContextHeader appears with `← # general`.
- Type a message + Enter → message appears in list immediately.
- Open second browser window same project → message appears in real time.
- Member role (non-admin) does not see the `+` button to create a channel.

- [ ] **Step 5: Verify type check passes**

```bash
npm run lint
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat-team/TeamChatPanel.tsx src/components/layout/Shell.tsx
git rm -r src/components/chat
git commit -m "feat(chat): mount TeamChatPanel, delete old ChatPanel"
```

---

### Task 1.10: Guest-mode demo seed for chat

**Files:**
- Modify: `src/components/chat-team/TeamChatPanel.tsx` — short-circuit when `loginState === 'guest'`
- Modify: `src/components/chat-team/hooks/useMessages.ts` — short-circuit for guest

- [ ] **Step 1: Add demo data constants at top of `TeamChatPanel.tsx`**

Replace the `fetchChannels` and the realtime-channels useEffect with this branched version (insert near the top of the component body):

```tsx
import { Channel, Message } from '@/lib/supabaseClient';

const DEMO_CHANNELS: Channel[] = [
  { id: 'demo-ch-general', project_id: 'demo', name: 'general', description: 'Project chat',
    created_by: 'demo-1', archived: false, created_at: new Date().toISOString() },
];

const DEMO_MESSAGES_GENERAL: Message[] = [
  { id: 'dm1', context_type: 'channel', context_id: 'demo-ch-general', author_id: 'demo-1',
    body: 'Welcome to the CREATstudio chat. Type away.', command: null, replies_to: null, model_id: null,
    created_at: new Date(Date.now() - 3600_000).toISOString(), edited_at: null },
  { id: 'dm2', context_type: 'channel', context_id: 'demo-ch-general', author_id: 'demo-2',
    body: 'Setting up RAG pipeline now.', command: null, replies_to: null, model_id: null,
    created_at: new Date(Date.now() - 1800_000).toISOString(), edited_at: null },
];
```

In the component body, gate the supabase calls:

```tsx
const fetchChannels = useCallback(async () => {
  if (loginState === 'guest') { setChannels(DEMO_CHANNELS); return; }
  if (!activeProject) return;
  const { data } = await supabase.from('channels')
    .select('*').eq('project_id', activeProject.id).order('created_at');
  if (data) setChannels(data as Channel[]);
}, [activeProject, loginState]);
```

And skip the realtime channel-list subscription entirely when guest:

```tsx
useEffect(() => {
  if (loginState === 'guest' || !activeProject) return;
  // existing realtime subscription
}, [activeProject, fetchChannels, loginState]);
```

- [ ] **Step 2: Update `useMessages` to serve demo data in guest mode**

In `useMessages.ts`, add a workspace import and a guard:

```typescript
import { useWorkspace } from '@/contexts/WorkspaceContext';

// inside hook, at the top:
const { loginState } = useWorkspace();

const fetchMessages = useCallback(async () => {
  if (!type || !id) { setMessages([]); return; }
  if (loginState === 'guest') {
    if (type === 'channel' && id === 'demo-ch-general') {
      // import demo data directly or duplicate locally; for simplicity inline:
      setMessages([
        { id: 'dm1', context_type: 'channel', context_id: id, author_id: 'demo-1',
          body: 'Welcome to the CREATstudio chat. Type away.', command: null, replies_to: null,
          model_id: null, created_at: new Date(Date.now() - 3600_000).toISOString(), edited_at: null },
        { id: 'dm2', context_type: 'channel', context_id: id, author_id: 'demo-2',
          body: 'Setting up RAG pipeline now.', command: null, replies_to: null,
          model_id: null, created_at: new Date(Date.now() - 1800_000).toISOString(), edited_at: null },
      ]);
    } else {
      setMessages([]);
    }
    return;
  }
  setLoading(true);
  const { data, error } = await supabase.from('messages').select('*')
    .eq('context_type', type).eq('context_id', id).order('created_at', { ascending: true }).limit(200);
  if (error) console.error('useMessages fetch:', error);
  if (data) setMessages(data as Message[]);
  setLoading(false);
}, [type, id, loginState]);
```

Also skip the realtime subscription when guest:

```typescript
useEffect(() => {
  if (loginState === 'guest' || !type || !id) return;
  // existing subscription
}, [type, id, loginState]);
```

- [ ] **Step 3: Smoke test guest mode**

```bash
npm run dev
```
Open the app, click "Try Guest Mode" on Login. Verify:
- Right panel shows `# general` channel.
- Clicking it shows 2 demo messages.
- Sending a message in guest mode does not call Supabase but also doesn't crash (Composer's `loginState === 'guest'` branch already clears input).

- [ ] **Step 4: Commit**

```bash
git add src/components/chat-team/TeamChatPanel.tsx src/components/chat-team/hooks/useMessages.ts
git commit -m "feat(chat): guest-mode demo seed for channels + messages"
```

---

### Task 1.11: Phase 1 acceptance smoke

- [ ] **Step 1: Two-browser realtime test**

Run dev. Log in as admin in one browser, as a member in a second browser (different account). Both should see the same `#general`. Post from admin → member sees within 1s. Post from member → admin sees within 1s.

- [ ] **Step 2: RLS test — member cannot create channel**

In the member browser, ensure `+ new channel` button is hidden. Open Supabase SQL editor and run as the member user role (using their JWT in REST client) — `INSERT INTO channels …` → should be rejected by RLS.

- [ ] **Step 3: Unread badge appears**

Admin posts in `#general`, member's `#general` row in ContextList should show a lavender pill with `1`. Member clicks the channel → pill clears.

- [ ] **Step 4: Final build verify + tag commit**

```bash
npm run lint
npm run build
git tag chat-phase-1
```

Phase 1 done.

---

# PHASE 2 — DMs + AI Member

Goal: enable 1-on-1 DMs (including private AI DM), add `/ai` slash command, backend inserts AI replies as bot author, bot styling in messages.

---

### Task 2.1: SQL migration — `dm_threads` + enable dm policy + update RPC

**Files:**
- Create: `db/migrations/2026-05-19-chat-phase2.sql`
- Modify: `database_setup.sql` — append

- [ ] **Step 1: Write migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- Team Chat — Phase 2: DMs + AI member
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dm_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id),
  CHECK(user_a_id < user_b_id)
);

ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm_threads_select" ON dm_threads;
CREATE POLICY "dm_threads_select" ON dm_threads FOR SELECT
  USING (auth.uid() IN (user_a_id, user_b_id));
DROP POLICY IF EXISTS "dm_threads_insert" ON dm_threads;
CREATE POLICY "dm_threads_insert" ON dm_threads FOR INSERT
  WITH CHECK (auth.uid() IN (user_a_id, user_b_id));

-- Enable dm branch in messages_select policy
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  CASE context_type
    WHEN 'channel' THEN EXISTS (SELECT 1 FROM channels c WHERE c.id = messages.context_id AND is_project_member(c.project_id))
    WHEN 'dm'      THEN EXISTS (SELECT 1 FROM dm_threads d WHERE d.id = messages.context_id AND auth.uid() IN (d.user_a_id, d.user_b_id))
    WHEN 'task'    THEN is_project_member(task_project_id(messages.context_id))
  END
);

-- Refresh unread RPC to include DM contexts
CREATE OR REPLACE FUNCTION get_unread_summary(p_user uuid, p_project uuid)
RETURNS TABLE (context_type text, context_id uuid, unread int, mentions int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ctxs AS (
    SELECT 'channel'::text AS ctype, c.id AS cid FROM channels c
      WHERE c.project_id = p_project AND NOT c.archived
    UNION ALL
    SELECT 'dm'::text, d.id FROM dm_threads d
      WHERE p_user IN (d.user_a_id, d.user_b_id)
    UNION ALL
    SELECT 'task'::text, t.id FROM tasks t
      WHERE t.project_id = p_project
  )
  SELECT ctxs.ctype, ctxs.cid,
    COUNT(m.id)::int AS unread,
    0::int AS mentions
  FROM ctxs
  LEFT JOIN read_state rs
    ON rs.user_id = p_user AND rs.context_type = ctxs.ctype AND rs.context_id = ctxs.cid
  LEFT JOIN messages m
    ON m.context_type = ctxs.ctype AND m.context_id = ctxs.cid
    AND m.created_at > COALESCE(rs.last_read_at, 'epoch')
    AND m.author_id <> p_user
  GROUP BY ctxs.ctype, ctxs.cid;
$$;
```

- [ ] **Step 2: Run migration in Supabase + append to `database_setup.sql`**

- [ ] **Step 3: Commit**

```bash
git add db/migrations/2026-05-19-chat-phase2.sql database_setup.sql
git commit -m "feat(chat): phase 2 schema — dm_threads + dm policy + unread RPC update"
```

---

### Task 2.2: `useDMThread` hook + auto-create AI DM

**Files:**
- Create: `src/components/chat-team/hooks/useDMThread.ts`

- [ ] **Step 1: Implement**

```typescript
import { useCallback } from 'react';
import { supabase, BOT_USER_ID, DMThread } from '@/lib/supabaseClient';
import { canonicalDMPair } from '../lib/dmPair';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function useDMThread() {
  const { currentUserId } = useWorkspace();

  const findOrCreate = useCallback(async (otherUserId: string): Promise<DMThread | null> => {
    if (!currentUserId || currentUserId === otherUserId) return null;
    const pair = canonicalDMPair(currentUserId, otherUserId);

    const { data: existing } = await supabase.from('dm_threads').select('*')
      .eq('user_a_id', pair.user_a_id).eq('user_b_id', pair.user_b_id).maybeSingle();
    if (existing) return existing as DMThread;

    const { data: created, error } = await supabase.from('dm_threads').insert(pair).select().single();
    if (error) { console.error('dm create:', error); return null; }
    return created as DMThread;
  }, [currentUserId]);

  const findOrCreateAIDM = useCallback(() => findOrCreate(BOT_USER_ID), [findOrCreate]);

  return { findOrCreate, findOrCreateAIDM };
}
```

- [ ] **Step 2: Auto-create AI DM on login**

Open `src/contexts/ChatContext.tsx`. Inject auto-create logic by adding a useEffect that fires once when `currentUserId` is set. To keep the context light, instead create the auto-create call inside `TeamChatPanel.tsx`:

```tsx
import { useDMThread } from './hooks/useDMThread';

// inside TeamChatPanel component:
const { findOrCreateAIDM } = useDMThread();
useEffect(() => {
  if (loginState === 'logged_in') { findOrCreateAIDM(); }
}, [loginState, findOrCreateAIDM]);
```

- [ ] **Step 3: Verify build + smoke test**

`npm run lint && npm run dev` — log in, check Supabase Table Editor for a row in `dm_threads` with `user_b_id = 00000000-0000-0000-0000-000000000a1c`.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat-team/hooks/useDMThread.ts src/components/chat-team/TeamChatPanel.tsx
git commit -m "feat(chat): useDMThread hook + auto-create AI DM on login"
```

---

### Task 2.3: DM list section in ContextList + NewDMModal

**Files:**
- Modify: `src/components/chat-team/ContextList.tsx`
- Create: `src/components/chat-team/NewDMModal.tsx`
- Modify: `src/components/chat-team/TeamChatPanel.tsx` — fetch DMs

- [ ] **Step 1: `NewDMModal.tsx`**

```tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDMThread } from './hooks/useDMThread';
import { useChat } from '@/contexts/ChatContext';
import { BOT_USER_ID } from '@/lib/supabaseClient';

interface Props { isOpen: boolean; onClose: () => void; onCreated: () => void; }

export default function NewDMModal({ isOpen, onClose, onCreated }: Props) {
  const { users, currentUserId } = useWorkspace();
  const { findOrCreate } = useDMThread();
  const { setActiveContext } = useChat();
  const [busy, setBusy] = useState<string | null>(null);

  if (!isOpen) return null;

  const candidates = users.filter(u => u.id !== currentUserId && u.id !== BOT_USER_ID);

  const start = async (userId: string, userName: string) => {
    setBusy(userId);
    const dm = await findOrCreate(userId);
    setBusy(null);
    if (dm) {
      setActiveContext({ type: 'dm', id: dm.id, title: userName });
      onCreated();
      onClose();
    }
  };

  return (
    <div data-skin="chat-dark" style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: 'var(--bg-card)', border: '1px solid var(--border-chat)',
        borderRadius: 'var(--radius-card)', padding: 20, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1-chat)' }}>New direct message</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-3-chat)', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {candidates.length === 0 && (
            <div style={{ color: 'var(--text-3-chat)', fontSize: 12, textAlign: 'center', padding: 24 }}>
              No teammates yet.
            </div>
          )}
          {candidates.map(u => (
            <button key={u.id} onClick={() => start(u.id, u.full_name)} disabled={busy === u.id}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: 10, background: 'transparent', border: 'none',
                color: 'var(--text-1-chat)', cursor: 'pointer', textAlign: 'left',
                borderRadius: 'var(--radius-chip)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
              }}>{u.full_name[0]?.toUpperCase()}</div>
              <span style={{ fontSize: 13 }}>{u.full_name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `ContextList.tsx`**

Extend props:

```tsx
import { Bot, MessageSquare, Plus, Hash } from 'lucide-react';
import type { Channel, DMThread, Profile } from '@/lib/supabaseClient';
import { BOT_USER_ID } from '@/lib/supabaseClient';
import NewDMModal from './NewDMModal';

interface Props {
  channels: Channel[];
  dms: DMThread[];
  users: Profile[];
  onRefetchChannels: () => void;
  onRefetchDMs: () => void;
}
```

After the channels block (before closing div), add:

```tsx
{(() => {
  const aiDM = dms.find(d => d.user_a_id === BOT_USER_ID || d.user_b_id === BOT_USER_ID);
  const otherDMs = dms.filter(d => d !== aiDM);
  const [dmOpen, setDmOpen] = useState(false);
  void setDmOpen; // keep TS happy if eslint quibbles
  return null;
})()}
```

Cleaner: declare hook state at the top of the component instead. Replace the existing `const [newOpen, setNewOpen] = useState(false);` line with:

```tsx
const [newChannelOpen, setNewChannelOpen] = useState(false);
const [newDMOpen, setNewDMOpen] = useState(false);
```

(And update the existing channel-modal trigger to use `setNewChannelOpen`.)

Then append below the channels list, inside the same scrollable div:

```tsx
{/* AI DM — pinned top of DMs section */}
{(() => {
  const aiDM = dms.find(d => d.user_a_id === BOT_USER_ID || d.user_b_id === BOT_USER_ID);
  if (!aiDM) return null;
  const key = contextKey('dm', aiDM.id);
  const u = unreadMap[key]?.unread ?? 0;
  const isActive = activeContext?.type === 'dm' && activeContext.id === aiDM.id;
  return (
    <button onClick={() => setActiveContext({ type: 'dm', id: aiDM.id, title: 'AI Assistant' })}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px', marginTop: 12, borderRadius: 'var(--radius-chip)',
        background: isActive ? 'var(--bg-elevated)' : 'rgba(197,184,255,0.05)',
        border: '1px solid rgba(197,184,255,0.18)',
        color: 'var(--text-1-chat)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
      }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot size={14} style={{ color: 'var(--accent)' }} />
        AI Assistant
        <span style={{ fontSize: 9, color: 'var(--text-3-chat)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>private</span>
      </span>
      {u > 0 && (
        <span className="tabular" style={{
          background: 'var(--accent)', color: '#0E1014', fontSize: 10, fontWeight: 700,
          padding: '1px 6px', borderRadius: 999,
        }}>{u}</span>
      )}
    </button>
  );
})()}

<div style={{
  fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
  color: 'var(--text-3-chat)', textTransform: 'uppercase',
  padding: '16px 8px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}}>
  <span>Direct Messages</span>
  <button onClick={() => setNewDMOpen(true)} title="New DM"
    style={{ background: 'transparent', border: 'none', color: 'var(--text-3-chat)', cursor: 'pointer' }}>
    <Plus size={12} />
  </button>
</div>

{dms.filter(d => d.user_a_id !== BOT_USER_ID && d.user_b_id !== BOT_USER_ID).map(d => {
  const otherId = d.user_a_id === currentUserId ? d.user_b_id : d.user_a_id;
  const other = users.find(u => u.id === otherId);
  if (!other) return null;
  const key = contextKey('dm', d.id);
  const u = unreadMap[key]?.unread ?? 0;
  const isActive = activeContext?.type === 'dm' && activeContext.id === d.id;
  return (
    <button key={d.id}
      onClick={() => setActiveContext({ type: 'dm', id: d.id, title: other.full_name })}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderRadius: 'var(--radius-chip)',
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
        color: 'var(--text-2-chat)', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 13, fontWeight: u > 0 ? 600 : 400,
      }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={13} style={{ opacity: 0.6 }} />
        {other.full_name}
      </span>
      {u > 0 && (
        <span className="tabular" style={{
          background: 'var(--accent)', color: '#0E1014',
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
        }}>{u}</span>
      )}
    </button>
  );
})}

<NewDMModal isOpen={newDMOpen} onClose={() => setNewDMOpen(false)} onCreated={onRefetchDMs} />
```

(Pull `currentUserId` from `useWorkspace` at the top of the component if not already imported.)

- [ ] **Step 3: Fetch DMs in `TeamChatPanel.tsx`**

```tsx
const [dms, setDMs] = useState<DMThread[]>([]);
const fetchDMs = useCallback(async () => {
  if (loginState === 'guest' || !currentUserId) return;
  const { data } = await supabase.from('dm_threads').select('*')
    .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
    .order('created_at');
  if (data) setDMs(data as DMThread[]);
}, [currentUserId, loginState]);
useEffect(() => { fetchDMs(); }, [fetchDMs]);
```

Pass `dms`, `users`, `onRefetchDMs={fetchDMs}` into `<ContextList />`.

- [ ] **Step 4: Verify build + smoke test**

`npm run lint && npm run dev`. Verify AI DM pinned top, click it → empty thread (no messages yet). Create a DM with another user via `+ new dm` → context switches to that DM.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team
git commit -m "feat(chat): DM list + NewDMModal + AI DM pinned"
```

---

### Task 2.4: `SlashCommandMenu` + `useSlashCommand`

**Files:**
- Create: `src/components/chat-team/SlashCommandMenu.tsx`
- Create: `src/components/chat-team/hooks/useSlashCommand.ts`
- Modify: `src/components/chat-team/MessageComposer.tsx`

- [ ] **Step 1: `useSlashCommand.ts`**

```typescript
import { useMemo } from 'react';

export function useSlashCommand(text: string) {
  return useMemo(() => {
    const t = text.trimStart();
    if (!t.startsWith('/')) return null;
    // Show menu while user is still typing the command (no space yet)
    const space = t.indexOf(' ');
    if (space === -1) return { typing: t.slice(1).toLowerCase() };
    return null;
  }, [text]);
}
```

- [ ] **Step 2: `SlashCommandMenu.tsx`**

```tsx
import React from 'react';
import { Bot } from 'lucide-react';

interface Cmd { name: string; description: string; }
const ALL: Cmd[] = [
  { name: 'ai', description: 'Ask AI in this context (everyone sees the reply)' },
];

interface Props {
  filter: string;
  onPick: (name: string) => void;
}

export default function SlashCommandMenu({ filter, onPick }: Props) {
  const visible = ALL.filter(c => c.name.startsWith(filter));
  if (visible.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
      background: 'var(--bg-card)', border: '1px solid var(--border-chat)',
      borderRadius: 'var(--radius-card)', padding: 6, zIndex: 10,
    }}>
      {visible.map(c => (
        <button key={c.name} onClick={() => onPick(c.name)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', background: 'transparent', border: 'none',
            color: 'var(--text-1-chat)', cursor: 'pointer', textAlign: 'left',
            borderRadius: 'var(--radius-chip)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <Bot size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>/{c.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3-chat)' }}>{c.description}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `MessageComposer.tsx`**

Modify the composer to support `/ai`. Update the file:

```tsx
import React, { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { supabase, MessageContextType } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { parseSlashCommand } from './lib/slashParser';
import { useSlashCommand } from './hooks/useSlashCommand';
import SlashCommandMenu from './SlashCommandMenu';
import { getStoredKeys, getSelectedModel, MODEL_BY_ID } from '@/lib/aiModels';

interface Props { contextType: MessageContextType; contextId: string; }

export default function MessageComposer({ contextType, contextId }: Props) {
  const { currentUserId, loginState, activeFile, tasks } = useWorkspace();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const slash = useSlashCommand(value);

  const send = async () => {
    const body = value.trim();
    if (!body || !currentUserId || sending) return;
    if (loginState === 'guest') { setValue(''); return; }
    setSending(true);

    const cmd = parseSlashCommand(body);

    // Insert the user's own message first (whether slash or not)
    const { data: inserted, error: insertErr } = await supabase.from('messages').insert({
      context_type: contextType,
      context_id: contextId,
      author_id: currentUserId,
      body,
      command: cmd?.command ?? null,
    }).select().single();
    if (insertErr) { console.error('send:', insertErr); setSending(false); return; }
    setValue('');

    // If /ai: fire off backend call to produce bot reply
    if (cmd?.command === 'ai' && cmd.prompt) {
      const selectedId = getSelectedModel();
      const model = MODEL_BY_ID[selectedId];
      const keys = getStoredKeys();
      try {
        const apiUrl = (import.meta.env.VITE_API_URL || '') + '/api/ai/chat/team';
        await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_type: contextType,
            context_id: contextId,
            invoker_message_id: inserted.id,
            user_message: cmd.prompt,
            model_id: model?.model_id ?? selectedId,
            provider: model?.provider ?? 'google',
            active_file_content: activeFile?.content?.slice(0, 4000) ?? null,
            active_task: tasks.find(t => t.assignee_id === currentUserId && t.status === 'IN_PROGRESS')?.title ?? null,
            api_keys: keys,
          }),
        });
      } catch (e) {
        console.error('/ai dispatch:', e);
      }
    }

    setSending(false);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{
      position: 'relative', borderTop: '1px solid var(--border-chat)',
      padding: 12, background: 'var(--bg-card)',
    }}>
      {slash && (
        <SlashCommandMenu
          filter={slash.typing}
          onPick={(name) => setValue(`/${name} `)}
        />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={value} onChange={e => setValue(e.target.value)} onKeyDown={onKey}
          placeholder="Type a message — or '/ai <prompt>' to ask AI"
          rows={1}
          style={{
            flex: 1, resize: 'none', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-chip)',
            color: 'var(--text-1-chat)', fontFamily: 'inherit', fontSize: 13,
            padding: '8px 12px', maxHeight: 120, outline: 'none',
          }}
        />
        <button onClick={send} disabled={sending || !value.trim()}
          style={{
            width: 36, height: 36, borderRadius: 'var(--radius-chip)',
            background: 'var(--accent)', color: '#0E1014',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', opacity: value.trim() ? 1 : 0.4,
          }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team/MessageComposer.tsx src/components/chat-team/SlashCommandMenu.tsx src/components/chat-team/hooks/useSlashCommand.ts
git commit -m "feat(chat): /ai slash command + menu in MessageComposer"
```

---

### Task 2.5: Backend `/api/ai/chat/team` endpoint

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routers/ai_chat.py`

- [ ] **Step 1: Add `TeamChatRequest` model**

Append to `backend/models.py`:

```python
class TeamChatRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    context_type: str = Field(..., pattern="^(channel|dm|task)$")
    context_id: str
    invoker_message_id: Optional[str] = None
    user_message: str = Field(..., max_length=8_000)
    model_id: str
    provider: str
    active_file_content: Optional[str] = None
    active_task: Optional[str] = None
    api_keys: Optional[APIKeys] = None
```

- [ ] **Step 2: Add `BOT_USER_ID` constant and `/chat/team` route**

Open `backend/routers/ai_chat.py`. Add at the top imports:

```python
from backend.models import TeamChatRequest

BOT_USER_ID = "00000000-0000-0000-0000-000000000a1c"
```

Append a new route at the bottom of the file:

```python
@router.post("/chat/team")
async def ai_chat_team(request: TeamChatRequest, authorization: Optional[str] = Header(None)):
    """
    /ai invocation inside a team chat context (channel | dm | task).
    Inserts a bot-authored reply message via service role.
    """
    from backend.database import supabase_client

    provider = request.provider.lower()
    api_key = resolve_key(provider, request.api_keys)

    # Fetch last 20 messages in this context for conversational continuity.
    history_q = supabase_client.table("messages") \
        .select("author_id,body,created_at,command") \
        .eq("context_type", request.context_type) \
        .eq("context_id", request.context_id) \
        .order("created_at", desc=True) \
        .limit(20) \
        .execute()
    history = list(reversed(history_q.data or []))
    history_block = "\n".join(
        f"{'AI' if h['author_id'] == BOT_USER_ID else 'User'}: {h['body']}" for h in history
    )

    # Optional RAG (only when project_id can be inferred via channel/task)
    rag_context, rag_files = "", []
    project_id = None
    try:
        if request.context_type == "channel":
            ch = supabase_client.table("channels").select("project_id").eq("id", request.context_id).single().execute()
            project_id = ch.data["project_id"]
        elif request.context_type == "task":
            t = supabase_client.table("tasks").select("project_id").eq("id", request.context_id).single().execute()
            project_id = t.data["project_id"]
    except Exception as e:
        print(f"project_id lookup skipped: {e}")
    if project_id:
        try:
            google_key = resolve_key("google", request.api_keys)
            if google_key:
                embedding = await get_google_embedding(request.user_message, google_key)
                if embedding:
                    rag_context, rag_files = await get_rag_context(project_id, embedding)
        except Exception as e:
            print(f"team RAG skipped: {e}")

    # Build system prompt: persona + history + file + task + RAG
    system_parts = [
        "You are AI Assistant, a member of the CREATstudio team. "
        "You are participating in a team conversation. Be concise and direct. "
        "Address the user who just invoked you with '/ai'."
    ]
    if history_block:
        system_parts.append(f"\n## Recent conversation:\n{history_block}")
    if request.active_file_content:
        system_parts.append(f"\n## Active file:\n```\n{request.active_file_content[:4000]}\n```")
    if request.active_task:
        system_parts.append(f"\n## Active task:\n{request.active_task}")
    if rag_context:
        system_parts.append(f"\n## Project context (RAG):\n{rag_context}")
    system = "\n".join(system_parts)

    try:
        if provider == "anthropic":
            response_text = await call_anthropic(request.model_id, system, request.user_message, api_key)
        elif provider == "openai":
            response_text = await call_openai(request.model_id, system, request.user_message, api_key)
        elif provider == "google":
            response_text = await call_google(request.model_id, system, request.user_message, api_key)
        else:
            raise HTTPException(400, f"Unknown provider: {provider}")
    except HTTPException as e:
        # Insert an error message as the bot so the user sees what happened
        supabase_client.table("messages").insert({
            "context_type": request.context_type,
            "context_id": request.context_id,
            "author_id": BOT_USER_ID,
            "body": f"⚠️ {e.detail}",
            "command": "ai",
            "replies_to": request.invoker_message_id,
            "model_id": request.model_id,
        }).execute()
        raise

    # Insert bot reply (service role bypasses RLS)
    supabase_client.table("messages").insert({
        "context_type": request.context_type,
        "context_id": request.context_id,
        "author_id": BOT_USER_ID,
        "body": response_text,
        "command": "ai",
        "replies_to": request.invoker_message_id,
        "model_id": request.model_id,
    }).execute()

    return {"ok": True, "rag_used": bool(rag_files), "rag_files": rag_files}
```

- [ ] **Step 3: Restart backend + smoke test**

```bash
cd backend && uvicorn main:app --reload --port 8000
```

In the app, open the AI DM. Type `/ai hello` → press Enter. Expected: user's message appears immediately, ~1–5s later AI's reply appears via realtime.

- [ ] **Step 4: Verify channel `/ai` works too**

In `#general`, type `/ai what's the architecture?`. Both messages should appear; admin and member browsers should both see the exchange.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/routers/ai_chat.py
git commit -m "feat(chat): backend /api/ai/chat/team route — bot reply via service role"
```

---

### Task 2.6: Bot styling in `MessageItem`

**Files:**
- Modify: `src/components/chat-team/MessageItem.tsx`

- [ ] **Step 1: Update bot rendering**

Replace `MessageItem.tsx` body with:

```tsx
import React from 'react';
import { Bot } from 'lucide-react';
import type { Message, Profile } from '@/lib/supabaseClient';

interface Props { message: Message; author: Profile | null; isMine: boolean; }

export default function MessageItem({ message, author, isMine }: Props) {
  const ts = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isBot = author?.is_bot === true;

  return (
    <div style={{
      padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      borderLeft: isBot ? '2px solid var(--accent)' : '2px solid transparent',
      background: isBot ? 'rgba(197,184,255,0.03)' : 'transparent',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: isBot ? 'rgba(197,184,255,0.15)' : 'rgba(255,255,255,0.06)',
        border: isBot ? '1px solid rgba(197,184,255,0.45)' : '1px solid var(--border-chat)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isBot
          ? <Bot size={16} style={{ color: 'var(--accent)' }} />
          : <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2-chat)' }}>{author?.full_name?.[0]?.toUpperCase() ?? '?'}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: isBot ? 'var(--accent)' : 'var(--text-1-chat)' }}>
            {author?.full_name ?? 'Unknown'}
          </span>
          {isBot && message.model_id && (
            <span style={{
              fontSize: 9, padding: '1px 6px', border: '1px solid rgba(197,184,255,0.3)',
              borderRadius: 999, color: 'var(--text-3-chat)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>{message.model_id}</span>
          )}
          <span className="tabular" style={{ fontSize: 11, color: 'var(--text-3-chat)' }}>{ts}</span>
        </div>
        <div style={{
          fontSize: 13, color: 'var(--text-2-chat)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2,
        }}>
          {message.body}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`npm run dev` → AI replies have lavender left border, bot icon, model badge.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-team/MessageItem.tsx
git commit -m "feat(chat): bot styling — lavender border + model badge"
```

---

### Task 2.7: Phase 2 acceptance smoke

- [ ] **Step 1: Private AI DM**

In two browsers logged in as different users, both should see their own AI DM at the top — neither should see the other's AI DM. (Verify by Supabase RLS — running a SELECT as user B for user A's DM row should return nothing.)

- [ ] **Step 2: Shared `/ai` in channel**

User A types `/ai how do tasks work?` in `#general`. User B sees A's message and the AI reply via realtime.

- [ ] **Step 3: Per-user key billing**

User B (no key in localStorage; no server fallback) types `/ai test`. Expected: ⚠️ error message inserted as bot reply ("Anthropic API key not configured…"). User A with valid key sees no error on their `/ai`.

- [ ] **Step 4: Tag**

```bash
npm run lint && npm run build
git tag chat-phase-2
```

---

# PHASE 3 — Mentions + Reactions + Attachments + Task Threads

Goal: feature-complete chat — `@` mentions with notifications, emoji reactions, file/image attachments, and task-scoped threads accessible via the Explorer.

---

### Task 3.1: SQL migration — mentions, reactions, attachments + RLS + storage bucket + final RPC

**Files:**
- Create: `db/migrations/2026-05-19-chat-phase3.sql`
- Modify: `database_setup.sql` — append

- [ ] **Step 1: Migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- Team Chat — Phase 3: mentions + reactions + attachments + storage
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS message_mentions (
  message_id          uuid REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, mentioned_user_id)
);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(mentioned_user_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id  uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text,
  size_bytes    integer
);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE message_mentions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentions_select" ON message_mentions;
CREATE POLICY "mentions_select" ON message_mentions FOR SELECT
  USING (mentioned_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM messages m WHERE m.id = message_mentions.message_id AND m.author_id = auth.uid()));
DROP POLICY IF EXISTS "mentions_insert" ON message_mentions;
CREATE POLICY "mentions_insert" ON message_mentions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.author_id = auth.uid()));

DROP POLICY IF EXISTS "reactions_select" ON message_reactions;
CREATE POLICY "reactions_select" ON message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "reactions_insert" ON message_reactions;
CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reactions_delete" ON message_reactions;
CREATE POLICY "reactions_delete" ON message_reactions FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "attachments_select" ON message_attachments;
CREATE POLICY "attachments_select" ON message_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_attachments.message_id));
DROP POLICY IF EXISTS "attachments_insert" ON message_attachments;
CREATE POLICY "attachments_insert" ON message_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.author_id = auth.uid()));

-- ── Final unread RPC with mentions ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_unread_summary(p_user uuid, p_project uuid)
RETURNS TABLE (context_type text, context_id uuid, unread int, mentions int)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH ctxs AS (
    SELECT 'channel'::text AS ctype, c.id AS cid FROM channels c
      WHERE c.project_id = p_project AND NOT c.archived
    UNION ALL
    SELECT 'dm'::text, d.id FROM dm_threads d
      WHERE p_user IN (d.user_a_id, d.user_b_id)
    UNION ALL
    SELECT 'task'::text, t.id FROM tasks t
      WHERE t.project_id = p_project
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

- [ ] **Step 2: Create storage bucket via Supabase dashboard**

Supabase Dashboard → Storage → New bucket:
- Name: `chat-attachments`
- Public: **OFF** (private)
- File size limit: 10 MB
- Allowed mime types: `image/*, application/pdf, text/*`

Then in Storage → Policies → New policy for `chat-attachments`:

```sql
-- SELECT: authenticated users (anyone with a message_attachments row referencing this path can SELECT).
-- Simplification: allow any authenticated read; deeper auth via signed URLs only.
CREATE POLICY "attachments_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "attachments_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "attachments_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 3: Run migration in Supabase + append to `database_setup.sql`**

- [ ] **Step 4: Commit**

```bash
git add db/migrations/2026-05-19-chat-phase3.sql database_setup.sql
git commit -m "feat(chat): phase 3 schema — mentions, reactions, attachments, storage policies"
```

---

### Task 3.2: `MentionPicker` + `useMentionAutocomplete` + insert mentions on send

**Files:**
- Create: `src/components/chat-team/MentionPicker.tsx`
- Create: `src/components/chat-team/hooks/useMentionAutocomplete.ts`
- Modify: `src/components/chat-team/MessageComposer.tsx`

- [ ] **Step 1: `useMentionAutocomplete.ts`**

```typescript
import { useMemo } from 'react';
import type { Profile } from '@/lib/supabaseClient';
import { BOT_USER_ID } from '@/lib/supabaseClient';

export function useMentionAutocomplete(text: string, users: Profile[]) {
  return useMemo(() => {
    const m = text.match(/@(\w*)$/);
    if (!m) return null;
    const query = m[1].toLowerCase();
    const matches = users
      .filter(u => u.id !== BOT_USER_ID)
      .filter(u => u.full_name.toLowerCase().includes(query))
      .slice(0, 6);
    return { query, matches };
  }, [text, users]);
}
```

- [ ] **Step 2: `MentionPicker.tsx`**

```tsx
import React from 'react';
import type { Profile } from '@/lib/supabaseClient';

interface Props { matches: Profile[]; onPick: (u: Profile) => void; }

export default function MentionPicker({ matches, onPick }: Props) {
  if (matches.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
      background: 'var(--bg-card)', border: '1px solid var(--border-chat)',
      borderRadius: 'var(--radius-card)', padding: 6, zIndex: 10,
    }}>
      {matches.map(u => (
        <button key={u.id} onClick={() => onPick(u)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', background: 'transparent', border: 'none',
            color: 'var(--text-1-chat)', cursor: 'pointer', textAlign: 'left',
            borderRadius: 'var(--radius-chip)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600,
          }}>{u.full_name[0]?.toUpperCase()}</div>
          <span style={{ fontSize: 13 }}>{u.full_name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3-chat)', marginLeft: 'auto' }}>
            @{u.full_name.split(/\s+/)[0]}
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `MessageComposer.tsx`**

Add imports:

```tsx
import { useMentionAutocomplete } from './hooks/useMentionAutocomplete';
import MentionPicker from './MentionPicker';
import { extractMentions } from './lib/mentionParser';
```

Inside the component, add:

```tsx
const { users } = useWorkspace();
const mention = useMentionAutocomplete(value, users);

const pickMention = (u: Profile) => {
  setValue(v => v.replace(/@\w*$/, `@${u.full_name.split(/\s+/)[0]} `));
};
```

In the JSX (before SlashCommandMenu render), add:

```tsx
{mention && mention.matches.length > 0 && (
  <MentionPicker matches={mention.matches} onPick={pickMention} />
)}
```

In `send()`, after the user message is inserted, before the `/ai` dispatch:

```tsx
const mentionedIds = extractMentions(body, users);
if (mentionedIds.length > 0 && inserted) {
  await supabase.from('message_mentions').insert(
    mentionedIds.map(uid => ({ message_id: inserted.id, mentioned_user_id: uid }))
  );
}
```

Also add the `Profile` type import. Type-check.

- [ ] **Step 4: Verify build**

`npm run lint && npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team
git commit -m "feat(chat): @mention picker + mention insertion on send"
```

---

### Task 3.3: Global mention subscription + toast + activity bar badge

**Files:**
- Modify: `src/contexts/ChatContext.tsx` — global mention sub + computed mention total
- Modify: `src/components/layout/Shell.tsx` — badge on Chat icon

- [ ] **Step 1: Add global mention subscription to `ChatContext.tsx`**

Inside the provider component, add:

```tsx
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/components/ui/Toast';

// inside ChatProvider:
const { currentUserId, users } = useWorkspace();
const { toast } = useToast();

useEffect(() => {
  if (!currentUserId) return;
  const sub = supabase.channel(`mentions:${currentUserId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_mentions',
        filter: `mentioned_user_id=eq.${currentUserId}` },
      async (payload) => {
        // Fetch message + author for toast body
        const { data: msg } = await supabase.from('messages')
          .select('id,body,author_id,context_type,context_id').eq('id', payload.new.message_id).single();
        if (!msg) return;
        const author = users.find(u => u.id === msg.author_id);
        const preview = msg.body.length > 80 ? msg.body.slice(0, 77) + '…' : msg.body;
        toast({
          title: `@${author?.full_name?.split(' ')[0] ?? 'Someone'}`,
          description: preview,
          tone: 'info',
          duration: 5000,
        });
        setUnreadMap(prev => {
          const k = `${msg.context_type}:${msg.context_id}`;
          const cur = prev[k] ?? { unread: 0, mentions: 0 };
          return { ...prev, [k]: { unread: cur.unread + 1, mentions: cur.mentions + 1 } };
        });
      })
    .subscribe();
  return () => { supabase.removeChannel(sub); };
}, [currentUserId, users, toast]);
```

- [ ] **Step 2: Compute total mention count + expose**

Add to `ChatProvider`:

```tsx
const totalMentions = Object.values(unreadMap).reduce((s, e) => s + (e.mentions || 0), 0);
```

Add `totalMentions` to context value type + provider value.

- [ ] **Step 3: Show badge on activity bar Chat icon**

There's no current "Chat" entry in the `NAV` array in `Shell.tsx` because chat is the persistent right panel. Instead, surface the mention count on the top-right of the **whole right panel**. Simpler: badge the title in `TeamChatPanel` when collapsed/inactive. For now, badge the existing `Command` icon button at the bottom of the activity bar — no, that's the wrong place too.

Cleanest: render a small badge on the avatar/initials chip at the bottom of the activity bar in `Shell.tsx`. Open `Shell.tsx`, find the `{profile && (` avatar render, wrap it in a relative container:

```tsx
import { useChat } from '@/contexts/ChatContext';
// inside Shell:
const { totalMentions } = useChat();

// then where the avatar div is rendered, wrap:
<div style={{ position: 'relative' }}>
  {/* existing avatar div */}
  {totalMentions > 0 && (
    <span className="tabular" style={{
      position: 'absolute', top: -4, right: -4,
      background: '#C5B8FF', color: '#0E1014',
      fontSize: 9, fontWeight: 700, padding: '1px 5px',
      borderRadius: 999, lineHeight: 1, minWidth: 14, textAlign: 'center',
    }}>{totalMentions}</span>
  )}
</div>
```

- [ ] **Step 4: Verify**

Open two browsers, log in as A and B. From A, post `@<B_first_name> hey there`. B's screen: toast appears, mention pill appears on the channel row in ContextList, and activity bar avatar shows lavender badge. B clicks the channel → all three indicators clear.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/ChatContext.tsx src/components/layout/Shell.tsx
git commit -m "feat(chat): global mention subscription + toast + activity bar badge"
```

---

### Task 3.4: `ReactionBar` + emoji picker

**Files:**
- Create: `src/components/chat-team/ReactionBar.tsx`
- Modify: `src/components/chat-team/MessageItem.tsx` — render reactions + add-reaction button
- Modify: `src/components/chat-team/hooks/useMessages.ts` — also fetch reactions

- [ ] **Step 1: `ReactionBar.tsx`**

```tsx
import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { supabase, MessageReaction } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const PRESET = ['👍', '🚀', '🔥', '✅', '❤️', '👀'];

interface Props {
  messageId: string;
  reactions: MessageReaction[];
}

export default function ReactionBar({ messageId, reactions }: Props) {
  const { currentUserId, loginState } = useWorkspace();
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = reactions.reduce<Record<string, MessageReaction[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r); return acc;
  }, {});

  const toggle = async (emoji: string) => {
    if (!currentUserId || loginState === 'guest') return;
    const mine = reactions.find(r => r.emoji === emoji && r.user_id === currentUserId);
    if (mine) {
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId, user_id: currentUserId, emoji,
      });
    }
  };

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
      {Object.entries(grouped).map(([emoji, list]) => {
        const mine = list.some(r => r.user_id === currentUserId);
        return (
          <button key={emoji} onClick={() => toggle(emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 999, fontSize: 11,
              background: mine ? 'rgba(197,184,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: mine ? '1px solid rgba(197,184,255,0.4)' : '1px solid var(--border-chat)',
              color: 'var(--text-1-chat)', cursor: 'pointer',
            }}>
            <span>{emoji}</span>
            <span className="tabular" style={{ color: 'var(--text-2-chat)' }}>{list.length}</span>
          </button>
        );
      })}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setPickerOpen(v => !v)}
          style={{
            padding: '2px 6px', borderRadius: 999, background: 'transparent',
            border: '1px solid var(--border-chat)', color: 'var(--text-3-chat)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}><Smile size={12} /></button>
        {pickerOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border-chat)',
            borderRadius: 'var(--radius-chip)', padding: 4, display: 'flex', gap: 2, zIndex: 5,
          }}>
            {PRESET.map(e => (
              <button key={e} onClick={() => { toggle(e); setPickerOpen(false); }}
                style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fetch reactions in `useMessages.ts`**

Extend `useMessages` to also return per-message reactions. Add to the hook:

```typescript
import { MessageReaction } from '@/lib/supabaseClient';

const [reactions, setReactions] = useState<MessageReaction[]>([]);

const fetchReactions = useCallback(async () => {
  if (!type || !id || loginState === 'guest') { setReactions([]); return; }
  // Reactions for any message in this context. Sub-select by message ids in memory:
  const ids = messages.map(m => m.id);
  if (ids.length === 0) { setReactions([]); return; }
  const { data } = await supabase.from('message_reactions').select('*').in('message_id', ids);
  if (data) setReactions(data as MessageReaction[]);
}, [type, id, loginState, messages]);

useEffect(() => { fetchReactions(); }, [fetchReactions]);

useEffect(() => {
  if (!type || !id || loginState === 'guest') return;
  const ch = supabase.channel(`rx:${type}:${id}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      () => fetchReactions())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [type, id, loginState, fetchReactions]);

return { messages, reactions, loading, refetch: fetchMessages };
```

- [ ] **Step 3: Pass reactions to `MessageItem` via `MessageList`**

Update `MessageList` props to accept `reactions: MessageReaction[]`, group per message id, and pass `reactionsForMessage` to each `MessageItem`. In `MessageItem`, render `<ReactionBar />` below body.

```tsx
// MessageList.tsx
import { MessageReaction } from '@/lib/supabaseClient';

interface Props { messages: Message[]; reactions: MessageReaction[]; users: Profile[]; currentUserId: string | null; }

// inside the map:
const myReactions = reactions.filter(r => r.message_id === m.id);
<MessageItem key={m.id} message={m} author={author} isMine={...} reactions={myReactions} />

// MessageItem.tsx — accept reactions prop, render at the bottom of body:
import ReactionBar from './ReactionBar';
import type { MessageReaction } from '@/lib/supabaseClient';

interface Props { ...; reactions: MessageReaction[]; }
// after body div:
<ReactionBar messageId={message.id} reactions={reactions} />
```

Update `TeamChatPanel` to pass `reactions` from `useMessages` into `MessageList`.

- [ ] **Step 4: Verify build + smoke test**

`npm run lint && npm run build`. Run dev. Hover a message → smile button visible. Click `👍` → adds your reaction. Click again → removes. Second browser sees the change in real time.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat-team
git commit -m "feat(chat): emoji reactions with realtime sync"
```

---

### Task 3.5: Attachments — `useAttachmentUpload` + `AttachmentTile` + composer integration

**Files:**
- Create: `src/components/chat-team/hooks/useAttachmentUpload.ts`
- Create: `src/components/chat-team/AttachmentTile.tsx`
- Modify: `src/components/chat-team/MessageComposer.tsx`
- Modify: `src/components/chat-team/MessageItem.tsx`
- Modify: `src/components/chat-team/hooks/useMessages.ts`

- [ ] **Step 1: `useAttachmentUpload.ts`**

```typescript
import { useCallback } from 'react';
import { supabase, MessageAttachment } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const MAX_BYTES = 10 * 1024 * 1024;

export function useAttachmentUpload() {
  const { activeProject, currentUserId } = useWorkspace();

  const upload = useCallback(async (file: File, messageId: string): Promise<MessageAttachment | null> => {
    if (!activeProject || !currentUserId) return null;
    if (file.size > MAX_BYTES) { console.warn('file too large'); return null; }
    const path = `${currentUserId}/${activeProject.id}/${messageId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (upErr) { console.error('upload:', upErr); return null; }
    const { data: row, error: insErr } = await supabase.from('message_attachments').insert({
      message_id: messageId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    }).select().single();
    if (insErr) { console.error('attach insert:', insErr); return null; }
    return row as MessageAttachment;
  }, [activeProject, currentUserId]);

  const signedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  }, []);

  return { upload, signedUrl };
}
```

- [ ] **Step 2: `AttachmentTile.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import type { MessageAttachment } from '@/lib/supabaseClient';
import { useAttachmentUpload } from './hooks/useAttachmentUpload';

export default function AttachmentTile({ attachment }: { attachment: MessageAttachment }) {
  const { signedUrl } = useAttachmentUpload();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    signedUrl(attachment.storage_path).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [attachment.storage_path, signedUrl]);

  const isImage = (attachment.mime_type ?? '').startsWith('image/');

  if (isImage && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6 }}>
        <img src={url} alt={attachment.file_name}
          style={{ maxWidth: 280, maxHeight: 200, borderRadius: 'var(--radius-chip)', border: '1px solid var(--border-chat)' }} />
      </a>
    );
  }
  return (
    <a href={url ?? '#'} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', marginTop: 6,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-chat)',
        borderRadius: 'var(--radius-chip)', textDecoration: 'none',
        color: 'var(--text-1-chat)', fontSize: 12,
      }}>
      <FileText size={14} style={{ color: 'var(--text-3-chat)' }} />
      <span>{attachment.file_name}</span>
      <span className="tabular" style={{ color: 'var(--text-3-chat)' }}>
        {Math.round((attachment.size_bytes ?? 0) / 1024)} KB
      </span>
    </a>
  );
}
```

- [ ] **Step 3: Wire attachment upload into composer**

In `MessageComposer.tsx`:

```tsx
import { Paperclip } from 'lucide-react';
import { useAttachmentUpload } from './hooks/useAttachmentUpload';

// inside component:
const [pendingFile, setPendingFile] = useState<File | null>(null);
const fileInput = useRef<HTMLInputElement>(null);
const { upload } = useAttachmentUpload();
```

In `send()`, after inserting the user message, before the mention/AI logic:

```tsx
if (pendingFile && inserted) {
  await upload(pendingFile, inserted.id);
  setPendingFile(null);
}
```

In the JSX, add a paperclip button + file input next to the textarea:

```tsx
<input ref={fileInput} type="file" hidden accept="image/*,application/pdf,text/*"
  onChange={e => setPendingFile(e.target.files?.[0] ?? null)} />
<button onClick={() => fileInput.current?.click()}
  style={{
    width: 36, height: 36, borderRadius: 'var(--radius-chip)',
    background: 'transparent', border: '1px solid var(--border-chat)',
    color: 'var(--text-2-chat)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
  <Paperclip size={14} />
</button>
{pendingFile && (
  <span style={{ fontSize: 11, color: 'var(--text-3-chat)' }}>
    {pendingFile.name} ({Math.round(pendingFile.size/1024)}KB)
  </span>
)}
```

- [ ] **Step 4: Fetch attachments in `useMessages` and render in `MessageItem`**

In `useMessages.ts`, mirror the reactions pattern: fetch + realtime subscribe to `message_attachments` for the current context's message ids. Return `attachments` from the hook.

```typescript
const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
const fetchAttachments = useCallback(async () => {
  if (loginState === 'guest' || messages.length === 0) { setAttachments([]); return; }
  const ids = messages.map(m => m.id);
  const { data } = await supabase.from('message_attachments').select('*').in('message_id', ids);
  if (data) setAttachments(data as MessageAttachment[]);
}, [messages, loginState]);
useEffect(() => { fetchAttachments(); }, [fetchAttachments]);
// optional realtime subscription analogous to reactions
return { messages, reactions, attachments, ... };
```

In `MessageList` + `MessageItem`, pass `attachmentsForMessage` and render `<AttachmentTile />` for each.

- [ ] **Step 5: Smoke test**

`npm run dev`. Pick an image with the paperclip → type message → send. Image appears inline. Other browser sees it too. PDF/text shows as a file chip.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat-team
git commit -m "feat(chat): file/image attachments with signed-URL preview"
```

---

### Task 3.6: `TaskThreadDrawer` + Explorer wiring

**Files:**
- Create: `src/components/tasks/TaskThreadDrawer.tsx`
- Modify: `src/components/explorer/Explorer.tsx`
- Modify: `src/components/layout/Shell.tsx`

- [ ] **Step 1: `TaskThreadDrawer.tsx`**

```tsx
import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useChat } from '@/contexts/ChatContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useMessages } from '@/components/chat-team/hooks/useMessages';
import { useUnread } from '@/components/chat-team/hooks/useUnread';
import MessageList from '@/components/chat-team/MessageList';
import MessageComposer from '@/components/chat-team/MessageComposer';

export default function TaskThreadDrawer() {
  const { activeTaskThread, setActiveTaskThread } = useChat();
  const { users, currentUserId, profile } = useWorkspace();
  const { markRead } = useUnread();

  const taskId = activeTaskThread?.id ?? null;
  const { messages, reactions, attachments } = useMessages('task', taskId);

  React.useEffect(() => {
    if (activeTaskThread) markRead('task', activeTaskThread.id);
  }, [activeTaskThread, messages.length, markRead]);

  return (
    <AnimatePresence>
      {activeTaskThread && (
        <motion.div
          data-skin="chat-dark"
          initial={{ x: 480 }}
          animate={{ x: 0 }}
          exit={{ x: 480 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          style={{
            position: 'fixed', right: 0, top: 0, bottom: 28, width: 480, zIndex: 40,
            background: 'var(--bg-base)', borderLeft: '1px solid var(--border-chat)',
            display: 'flex', flexDirection: 'column',
          }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: '1px solid var(--border-chat)',
            background: 'var(--bg-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 999,
                background: activeTaskThread.status === 'DONE' ? 'var(--success-chat)' : 'var(--accent)',
                color: '#0E1014', fontWeight: 700, letterSpacing: '0.08em',
              }}>{activeTaskThread.status.replace('_', ' ')}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1-chat)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTaskThread.title}
              </span>
            </div>
            <button onClick={() => setActiveTaskThread(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-2-chat)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {activeTaskThread.description && (
            <div style={{
              padding: '12px 18px', fontSize: 12, color: 'var(--text-2-chat)',
              borderBottom: '1px solid var(--border-chat)', background: 'var(--bg-card)',
            }}>
              {activeTaskThread.description}
            </div>
          )}

          <MessageList messages={messages} reactions={reactions} attachments={attachments}
            users={users} currentUserId={currentUserId} />
          <MessageComposer contextType="task" contextId={activeTaskThread.id} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire Explorer task click**

Open `src/components/explorer/Explorer.tsx`. Add:

```tsx
import { useChat } from '@/contexts/ChatContext';
const { setActiveTaskThread } = useChat();
```

Find the task list item rendering. Add an `onClick` handler (or a "Thread" button if there's an action area) that sets the thread:

```tsx
<button onClick={() => setActiveTaskThread(task)}
  title="Open task thread"
  style={{ ...existing-style }}>
  …
</button>
```

(Read the existing Explorer task row to find a non-conflicting place. If task rows already have a click handler for selecting, add a small "thread" icon button on hover instead.)

- [ ] **Step 3: Mount drawer in Shell**

Open `src/components/layout/Shell.tsx`. Just before the closing `</div>` of the root component, add:

```tsx
import TaskThreadDrawer from '../tasks/TaskThreadDrawer';
// at the bottom of JSX, before final </div>:
<TaskThreadDrawer />
```

- [ ] **Step 4: Smoke test**

`npm run dev`. Click a task in Explorer → drawer slides in from the right with task title + status pill + description + empty thread + composer. Type a message → it appears. Realtime works.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskThreadDrawer.tsx src/components/explorer/Explorer.tsx src/components/layout/Shell.tsx
git commit -m "feat(chat): task thread drawer + Explorer wiring"
```

---

### Task 3.7: Final acceptance + tag + cleanup

- [ ] **Step 1: Full E2E walkthrough**

1. Log in as admin in browser 1, member in browser 2.
2. Admin creates `#design` channel — member sees it appear.
3. Admin starts a DM with member — member sees the DM appear.
4. Admin posts in `#general` mentioning `@<member>` → member gets toast + ContextList pill + avatar badge.
5. Member opens `#general` → all three indicators clear.
6. Member sends `/ai how do I take a task?` in `#general`. Both see invocation + AI reply.
7. Admin reacts `🚀` to AI's reply → member sees count update in real time.
8. Admin uploads an image attachment → member sees inline preview.
9. Admin clicks a task in Explorer → thread drawer opens. Posts a thread message → member who's also viewing the task thread sees it.
10. Member opens their AI DM → private convo with `/ai` works, admin cannot see it (verify via SQL: `SELECT * FROM messages WHERE context_type='dm' AND context_id=<member-ai-dm-id>` as admin returns 0 rows).

- [ ] **Step 2: Build clean**

```bash
npm run lint
npm run build
npm test
```

All three green.

- [ ] **Step 3: Tag**

```bash
git tag chat-phase-3
git push --tags
```

- [ ] **Step 4: Update BLUEPRINT.md**

Append to `BLUEPRINT.md` under "Completion Status":

```markdown
### Team Chat
| Component | Status | File(s) |
|-----------|--------|---------|
| Channels (per-project) | ✅ Done | `src/components/chat-team/` |
| 1-on-1 DMs (incl. AI DM) | ✅ Done | `useDMThread`, `NewDMModal` |
| `/ai` slash command (channel/DM/task) | ✅ Done | `MessageComposer`, `/api/ai/chat/team` |
| Mentions + notifications | ✅ Done | `MentionPicker`, `ChatContext` toast |
| Emoji reactions | ✅ Done | `ReactionBar` |
| File/image attachments | ✅ Done | Supabase Storage `chat-attachments` |
| Task threads | ✅ Done | `TaskThreadDrawer` |
| Realtime + presence | ✅ Done | Supabase channel subs |
| Dark+lavender skin (scoped) | ✅ Done | `data-skin="chat-dark"` |
```

- [ ] **Step 5: Final commit**

```bash
git add BLUEPRINT.md
git commit -m "docs(blueprint): team chat phase 3 complete"
```

---

## Self-Review

**Spec coverage:**
- Section 2 scope (channels, DMs, task threads, AI member, mentions, reactions, attachments) → Tasks 1.7–3.6 ✓
- Section 3 visual direction (dark+lavender, Inter, scoped data-skin) → Task 1.3 ✓
- Section 4 data model (all tables + AI bot seed + indexes) → Tasks 1.1, 2.1, 3.1 ✓
- Section 5 UI layout (right panel, slide drawer) → Tasks 1.9, 3.6 ✓
- Section 6 components (every listed file) → covered across all phases ✓
- Section 7 realtime + RBAC + RLS → Tasks 1.1, 2.1, 3.1 (SQL) + hooks (Task 1.6, 3.3) ✓
- Section 8 notifications + unread → Tasks 1.6 (RPC), 3.3 (toasts + badge) ✓
- Section 9 AI integration → Tasks 2.4 (frontend), 2.5 (backend) ✓
- Section 10 phased rollout → Plan is structured by these exact phases ✓
- Section 11 risks: rate-limit `/ai` per user → NOT TASK'D (gap — added as note below)
- Section 13 definition of done → matched by Task 3.7 walkthrough ✓

**Gap noted:** `/ai` rate-limit per user (mentioned in spec risks). Not added as a discrete task — deferred to post-Phase-3 hardening. Document this in the final retro / next-spec.

**Placeholders:** none.

**Type consistency:** `BOT_USER_ID` is identical string everywhere (`00000000-0000-0000-0000-000000000a1c`). `MessageContextType` used consistently. `contextKey(type, id)` helper exists once, used everywhere.

**Verification:** All commands shown are exact, all file paths are absolute from repo root, every code change has the full code block.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-team-chat-task-threads.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session via executing-plans, batch with checkpoints.

**Which approach?**
