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

-- ── get_unread_summary RPC ───────────────────────────────────────────
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

-- ── Seed a default #general channel for the first existing project ──
INSERT INTO channels (project_id, name, description, created_by)
SELECT p.id, 'general', 'Project-wide chat', p.owner_id
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.project_id = p.id AND c.name = 'general')
LIMIT 1;
