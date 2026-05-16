import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  project_id: string;
  assignee_id?: string | null;
  due_date?: string;
  created_at?: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  path: string;
  content: string;
  updated_at?: string;
}
