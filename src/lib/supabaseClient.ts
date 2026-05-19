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
  avatar_url?: string | null;
  created_at: string;
  is_bot?: boolean;
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
  progress?: number | null;
  archived?: boolean | null;
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

export const BOT_USER_ID = '00000000-0000-0000-0000-000000000a1c' as const;

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
  context_type: string;
  context_id: string;
  last_read_at: string;
}
