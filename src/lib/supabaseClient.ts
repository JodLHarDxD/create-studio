import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const fallbackSupabaseUrl = 'https://placeholder.supabase.co';
const fallbackSupabaseAnonKey = 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Guest mode is available, but login/register require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = createClient(
  supabaseUrl || fallbackSupabaseUrl,
  supabaseAnonKey || fallbackSupabaseAnonKey,
);

export type UserRole = 'ADMIN' | 'MEMBER';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  bio?: string;
  github_url?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority?: 'LOW' | 'MED' | 'HIGH';
  project_id: string;
  assignee_id?: string | null;
  creator_id?: string | null;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  url?: string | null;
  original_zip_path?: string | null;
  patched_zip_path?: string | null;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  name?: string;
  path: string;
  content: string;
  language?: string;
  created_by?: string;
  updated_at?: string;
}

export interface LocalFileView {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
  content: string;
  objectUrl?: string;
  mimeType: string;
  lastModified: number;
}
