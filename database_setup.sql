-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Custom types ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'MEMBER',
  bio TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status task_status NOT NULL DEFAULT 'TODO',
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT DEFAULT '',
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-create profile on signup ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'MEMBER')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Vector similarity search function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_project_files(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (id uuid, name text, path text, content text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    project_files.id,
    project_files.file_name AS name,
    project_files.path,
    project_files.content,
    1 - (project_files.embedding <=> query_embedding) AS similarity
  FROM project_files
  WHERE project_files.project_id = p_project_id
    AND project_files.embedding IS NOT NULL
    AND 1 - (project_files.embedding <=> query_embedding) > match_threshold
  ORDER BY project_files.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Helper: is current user admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN');
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles: everyone can see profiles, only self can update
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- projects: admins see all, members see all (single-project scope for assignment)
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (auth.uid() = owner_id OR is_admin());
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (auth.uid() = owner_id OR is_admin());
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (is_admin());

-- tasks: admins see/edit all; members see & update only their own
DROP POLICY IF EXISTS "tasks_select_admin" ON tasks;
CREATE POLICY "tasks_select_admin" ON tasks FOR SELECT USING (is_admin() OR assignee_id = auth.uid() OR assignee_id IS NULL);
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "tasks_update_admin" ON tasks;
CREATE POLICY "tasks_update_admin" ON tasks FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "tasks_update_member" ON tasks;
CREATE POLICY "tasks_update_member" ON tasks FOR UPDATE USING (assignee_id = auth.uid());
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (is_admin());

-- project_files: all authenticated users can read; admins & file ops via service key can write
DROP POLICY IF EXISTS "files_select" ON project_files;
CREATE POLICY "files_select" ON project_files FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "files_insert" ON project_files;
CREATE POLICY "files_insert" ON project_files FOR INSERT WITH CHECK (is_admin());
DROP POLICY IF EXISTS "files_update" ON project_files;
CREATE POLICY "files_update" ON project_files FOR UPDATE USING (is_admin());
DROP POLICY IF EXISTS "files_delete" ON project_files;
CREATE POLICY "files_delete" ON project_files FOR DELETE USING (is_admin());

-- ── Additional task columns (run once after initial setup) ───────────────────
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'MED'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN original_zip_path TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN patched_zip_path TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN progress INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tasks ADD COLUMN archived BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Additional profile columns ────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE profiles ADD COLUMN avatar_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_embedding ON project_files USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
