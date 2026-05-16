-- TeamForge / Kinetix OS Supabase schema repair + install script
-- Paste this entire file into Supabase SQL Editor and run it once.
--
-- This is designed for both:
-- 1. a brand-new Supabase project
-- 2. a partially-created project where some tables already exist but columns are missing
--
-- It is non-destructive: it creates/repairs objects, adds missing columns,
-- recreates app-owned policies/functions, and does not drop existing data tables.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Enums expected by the app
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.task_status AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'MEMBER',
  bio text DEFAULT '',
  github_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  owner_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  status public.task_status NOT NULL DEFAULT 'TODO',
  project_id uuid,
  assignee_id uuid,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  file_name text,
  path text,
  content text DEFAULT '',
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  model_id text,
  provider text,
  rag_used boolean DEFAULT false,
  rag_files text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Repair columns for partially-created existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'MEMBER',
  ADD COLUMN IF NOT EXISTS bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS github_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status public.task_status DEFAULT 'TODO',
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.project_files
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS rag_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_files text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- If an older schema used project_files.name instead of file_name, preserve it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_files'
      AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE public.project_files SET file_name = COALESCE(file_name, name)';
  END IF;
END $$;

-- If older columns were created as text, convert them to the enums the app expects.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
      AND udt_name <> 'user_role'
  ) THEN
    EXECUTE $sql$
      UPDATE public.profiles
      SET role = 'MEMBER'
      WHERE role IS NULL OR role::text NOT IN ('ADMIN', 'MEMBER')
    $sql$;

    EXECUTE $sql$
      ALTER TABLE public.profiles
      ALTER COLUMN role TYPE public.user_role
      USING role::text::public.user_role
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'status'
      AND udt_name <> 'task_status'
  ) THEN
    EXECUTE $sql$
      UPDATE public.tasks
      SET status = 'TODO'
      WHERE status IS NULL OR status::text NOT IN ('TODO', 'IN_PROGRESS', 'DONE')
    $sql$;

    EXECUTE $sql$
      ALTER TABLE public.tasks
      ALTER COLUMN status TYPE public.task_status
      USING status::text::public.task_status
    $sql$;
  END IF;
END $$;

-- Ensure primary keys exist on the app tables.
DO $$
BEGIN
  UPDATE public.projects SET id = gen_random_uuid() WHERE id IS NULL;
  UPDATE public.tasks SET id = gen_random_uuid() WHERE id IS NULL;
  UPDATE public.project_files SET id = gen_random_uuid() WHERE id IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.project_files'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.project_files ADD CONSTRAINT project_files_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Fill required values where old rows are incomplete.
UPDATE public.profiles
SET
  email = COALESCE(NULLIF(email, ''), 'unknown@example.com'),
  full_name = COALESCE(full_name, ''),
  role = COALESCE(role, 'MEMBER'::public.user_role),
  bio = COALESCE(bio, ''),
  github_url = COALESCE(github_url, ''),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.projects
SET
  name = COALESCE(NULLIF(name, ''), 'Kinetix OS Core'),
  description = COALESCE(description, ''),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.tasks
SET
  title = COALESCE(NULLIF(title, ''), 'Untitled Task'),
  description = COALESCE(description, ''),
  status = COALESCE(status, 'TODO'::public.task_status),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.project_files
SET
  file_name = COALESCE(NULLIF(file_name, ''), 'untitled.txt'),
  path = COALESCE(NULLIF(path, ''), file_name, 'untitled.txt'),
  content = COALESCE(content, ''),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

-- Apply NOT NULL guarantees used by the app where existing data now allows it.
ALTER TABLE public.profiles
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.projects
  ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.tasks
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.project_files
  ALTER COLUMN file_name SET NOT NULL,
  ALTER COLUMN path SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Foreign keys
-- Use NOT VALID so existing orphaned legacy rows do not block the migration.
-- New rows are still checked.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_auth_users_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_auth_users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_id_profiles_id_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_owner_id_profiles_id_fkey
      FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_id_projects_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_project_id_projects_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignee_id_profiles_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assignee_id_profiles_id_fkey
      FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_files_project_id_projects_id_fkey'
  ) THEN
    ALTER TABLE public.project_files
      ADD CONSTRAINT project_files_project_id_projects_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS projects_set_updated_at ON public.projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS project_files_set_updated_at ON public.project_files;
CREATE TRIGGER project_files_set_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth profile bootstrap
-- Creates a profile row whenever a Supabase Auth user is created.
-- If the frontend sends raw_user_meta_data.full_name or raw_user_meta_data.role,
-- those values are used. Otherwise it defaults safely to MEMBER.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  requested_role public.user_role;
BEGIN
  requested_role :=
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'ADMIN' THEN 'ADMIN'::public.user_role
      ELSE 'MEMBER'::public.user_role
    END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1), 'New User'),
    requested_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users.
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  au.id,
  COALESCE(au.email, ''),
  COALESCE(NULLIF(au.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(au.email, ''), '@', 1), 'New User'),
  CASE WHEN au.raw_user_meta_data->>'role' = 'ADMIN' THEN 'ADMIN'::public.user_role ELSE 'MEMBER'::public.user_role END
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helper functions and RAG RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'::public.user_role
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.match_project_files(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (id uuid, name text, path text, content text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    pf.id,
    pf.file_name AS name,
    pf.path,
    pf.content,
    1 - (pf.embedding <=> query_embedding) AS similarity
  FROM public.project_files pf
  WHERE pf.project_id = p_project_id
    AND pf.embedding IS NOT NULL
    AND 1 - (pf.embedding <=> query_embedding) > match_threshold
  ORDER BY pf.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select
  ON public.profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select
  ON public.projects
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS projects_insert_admin_or_owner ON public.projects;
CREATE POLICY projects_insert_admin_or_owner
  ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS projects_update_admin_or_owner ON public.projects;
CREATE POLICY projects_update_admin_or_owner
  ON public.projects
  FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS projects_delete_admin ON public.projects;
CREATE POLICY projects_delete_admin
  ON public.projects
  FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS tasks_select_visible ON public.tasks;
CREATE POLICY tasks_select_visible
  ON public.tasks
  FOR SELECT
  USING (public.is_admin() OR assignee_id = auth.uid() OR assignee_id IS NULL);

DROP POLICY IF EXISTS tasks_insert_admin ON public.tasks;
CREATE POLICY tasks_insert_admin
  ON public.tasks
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS tasks_update_admin ON public.tasks;
CREATE POLICY tasks_update_admin
  ON public.tasks
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS tasks_update_assignee ON public.tasks;
CREATE POLICY tasks_update_assignee
  ON public.tasks
  FOR UPDATE
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

DROP POLICY IF EXISTS tasks_update_take_unassigned ON public.tasks;
CREATE POLICY tasks_update_take_unassigned
  ON public.tasks
  FOR UPDATE
  USING (assignee_id IS NULL)
  WITH CHECK (assignee_id = auth.uid());

DROP POLICY IF EXISTS tasks_delete_admin ON public.tasks;
CREATE POLICY tasks_delete_admin
  ON public.tasks
  FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS project_files_select_authenticated ON public.project_files;
CREATE POLICY project_files_select_authenticated
  ON public.project_files
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS project_files_insert_admin ON public.project_files;
CREATE POLICY project_files_insert_admin
  ON public.project_files
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS project_files_update_admin ON public.project_files;
CREATE POLICY project_files_update_admin
  ON public.project_files
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS project_files_delete_admin ON public.project_files;
CREATE POLICY project_files_delete_admin
  ON public.project_files
  FOR DELETE
  USING (public.is_admin());

-- chat_messages: users see own messages; admins see all; insert own only
DROP POLICY IF EXISTS chat_messages_select ON public.chat_messages;
CREATE POLICY chat_messages_select
  ON public.chat_messages
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chat_messages_delete_own ON public.chat_messages;
CREATE POLICY chat_messages_delete_own
  ON public.chat_messages
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_project ON public.chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON public.chat_messages(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_files_embedding'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_files_embedding
      ON public.project_files
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- The frontend subscribes to tasks and project_files changes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tasks'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'project_files'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.project_files;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_project_files(vector, float, int, uuid) TO authenticated, service_role;

-- Ask PostgREST/Supabase API to refresh its schema cache after this migration.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Optional starter data
-- After registering your first user, run the small admin seed below manually
-- if the app does not create a project automatically.
--
-- UPDATE public.profiles
-- SET role = 'ADMIN'
-- WHERE email = 'your-email@example.com';
--
-- INSERT INTO public.projects (name, description, owner_id)
-- SELECT 'Kinetix OS Core', 'Main development workspace', id
-- FROM public.profiles
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verification result
-- ---------------------------------------------------------------------------
SELECT
  'TeamForge schema installed' AS status,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS profiles_table,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') AS projects_table,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') AS tasks_table,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_files') AS project_files_table,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') AS chat_messages_table,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_project_files') AS rag_function;
