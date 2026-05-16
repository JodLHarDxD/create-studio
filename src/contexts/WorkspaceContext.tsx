import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, Profile, Project, Task, ProjectFile, LocalFileView } from '@/lib/supabaseClient';
import { getSelectedModel } from '@/lib/aiModels';

interface WorkspaceContextType {
  profile: Profile | null;
  userRole: 'ADMIN' | 'MEMBER';
  currentUserId: string | null;
  loginState: 'logged_out' | 'logged_in' | 'guest';
  setLoginState: (s: 'logged_out' | 'logged_in' | 'guest') => void;
  setCurrentUserId: (id: string | null) => void;
  setUserRole: (role: 'ADMIN' | 'MEMBER') => void;
  setProfile: (p: Profile | null) => void;
  logout: () => Promise<void>;
  activeProject: Project | null;
  projects: Project[];
  files: ProjectFile[];
  tasks: Task[];
  users: Profile[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  activeFile: ProjectFile | null;
  setActiveFile: (f: ProjectFile | null) => void;
  view: 'editor' | 'dashboard' | 'profile';
  setView: (v: 'editor' | 'dashboard' | 'profile') => void;
  isLoading: boolean;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  refetchFiles: () => Promise<void>;
  refetchTasks: () => Promise<void>;
  localActiveFile: LocalFileView | null;
  setLocalActiveFile: (f: LocalFileView | null) => void;
  diffTask: Task | null;
  setDiffTask: (t: Task | null) => void;
  diffMode: 'zip' | 'live';
  setDiffMode: (m: 'zip' | 'live') => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const DEMO_PROJECT: Project = { id: 'demo', name: 'Kinetix OS Core', owner_id: 'demo', created_at: new Date().toISOString() };
const DEMO_USERS: Profile[] = [
  { id: 'demo-1', email: 'admin@kinetix.os', full_name: 'Admin User', role: 'ADMIN', created_at: new Date().toISOString() },
  { id: 'demo-2', email: 'dev@kinetix.os', full_name: 'Dev Member', role: 'MEMBER', created_at: new Date().toISOString() },
];
const DEMO_FILES: ProjectFile[] = [
  { id: '1', project_id: 'demo', file_name: 'App.tsx', path: 'src/App.tsx', content: '// Kinetix App Shell\nimport React from "react";\nexport default function App() {\n  return <div>Welcome to the Neural Interface.</div>;\n}' },
  { id: '2', project_id: 'demo', file_name: 'main.py', path: 'backend/main.py', content: 'from fastapi import FastAPI\napp = FastAPI(title="Kinetix API")\n\n@app.get("/")\ndef root():\n    return {"status": "operational"}' },
];
const DEMO_TASKS: Task[] = [
  { id: '1', title: 'Setup database', status: 'DONE', project_id: 'demo', assignee_id: 'demo-1', description: 'Run init.sql in Supabase', due_date: new Date().toISOString() },
  { id: '2', title: 'Implement RAG pipeline', status: 'IN_PROGRESS', project_id: 'demo', assignee_id: 'demo-2', description: 'Vector embeddings for project files', due_date: new Date().toISOString() },
  { id: '3', title: 'Deploy to Railway', status: 'TODO', project_id: 'demo', assignee_id: 'demo-1', description: 'Configure env vars and deploy', due_date: new Date().toISOString() },
  { id: '4', title: 'Write API endpoints', status: 'IN_PROGRESS', project_id: 'demo', assignee_id: 'demo-2', description: 'Projects, tasks, files CRUD', due_date: new Date().toISOString() },
  { id: '5', title: 'Fix Dashboard Bug', status: 'TODO', project_id: 'demo', assignee_id: null, description: 'Charts not rendering on mobile', due_date: new Date().toISOString() },
];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loginState, setLoginState] = useState<'logged_out' | 'logged_in' | 'guest'>('logged_out');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [localActiveFile, setLocalActiveFile] = useState<LocalFileView | null>(null);
  const [diffTask, setDiffTask] = useState<Task | null>(null);
  const [diffMode, setDiffMode] = useState<'zip' | 'live'>('zip');
  const [view, setView] = useState<'editor' | 'dashboard' | 'profile'>('editor');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModelState] = useState<string>(getSelectedModel());

  const setSelectedModel = (m: string) => {
    setSelectedModelState(m);
    localStorage.setItem('tf_selected_model', m);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
          if (data) { setProfile(data); setUserRole(data.role); setLoginState('logged_in'); }
        });
      }
      setIsLoading(false);
    }).catch(error => {
      console.warn('Supabase session check skipped:', error);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        setLoginState('logged_in');
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data: prof }) => {
          if (prof) { setProfile(prof); setUserRole(prof.role); }
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const refetchFiles = useCallback(async () => {
    if (!activeProject || loginState === 'guest') return;
    const { data } = await supabase.from('project_files').select('*').eq('project_id', activeProject.id).order('path');
    if (data) setFiles(data);
  }, [activeProject, loginState]);

  const refetchTasks = useCallback(async () => {
    if (!activeProject || loginState === 'guest') return;
    const { data } = await supabase.from('tasks').select('*').eq('project_id', activeProject.id).order('created_at');
    if (data) setTasks(data);
  }, [activeProject, loginState]);

  useEffect(() => {
    if (loginState === 'guest') {
      setProjects([DEMO_PROJECT]); setActiveProject(DEMO_PROJECT);
      setFiles(DEMO_FILES); setActiveFile(DEMO_FILES[0]);
      setTasks(DEMO_TASKS); setUsers(DEMO_USERS);
      setIsLoading(false); return;
    }
    if (loginState !== 'logged_in' || !currentUserId) return;

    let tasksSub: any = null;
    let filesSub: any = null;

    async function loadData() {
      setIsLoading(true);
      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setUsers(profilesData);

      const { data: projectsData } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(1);
      if (projectsData && projectsData.length > 0) {
        const proj = projectsData[0];
        setProjects(projectsData); setActiveProject(proj);

        const { data: filesData } = await supabase.from('project_files').select('*').eq('project_id', proj.id).order('path');
        if (filesData) { setFiles(filesData); if (filesData.length > 0) setActiveFile(filesData[0]); }

        const { data: tasksData } = await supabase.from('tasks').select('*').eq('project_id', proj.id).order('created_at');
        if (tasksData) setTasks(tasksData);

        filesSub = supabase.channel('files').on('postgres_changes', { event: '*', schema: 'public', table: 'project_files', filter: `project_id=eq.${proj.id}` }, () => refetchFiles()).subscribe();
        tasksSub = supabase.channel('tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${proj.id}` }, () => refetchTasks()).subscribe();
      } else {
        const { data: newProj } = await supabase.from('projects').insert({ name: 'Kinetix OS Core', description: 'Main development workspace', owner_id: currentUserId }).select().single();
        if (newProj) await supabase.from('project_members').insert({ project_id: newProj.id, user_id: currentUserId, role: 'ADMIN' }).then(() => {});
        loadData();
      }
      setIsLoading(false);
    }

    loadData();
    return () => {
      if (tasksSub) supabase.removeChannel(tasksSub);
      if (filesSub) supabase.removeChannel(filesSub);
    };
  }, [loginState, currentUserId]);

  const logout = async () => {
    await supabase.auth.signOut();
    setLoginState('logged_out'); setCurrentUserId(null); setProfile(null);
    setProjects([]); setFiles([]); setTasks([]); setActiveFile(null); setActiveProject(null);
  };

  return (
    <WorkspaceContext.Provider value={{
      profile, userRole, currentUserId, loginState, setLoginState, setCurrentUserId, setUserRole, setProfile, logout,
      activeProject, projects, files, tasks, users, setTasks,
      activeFile, setActiveFile, view, setView, isLoading,
      selectedModel, setSelectedModel, refetchFiles, refetchTasks,
      localActiveFile, setLocalActiveFile,
      diffTask, setDiffTask, diffMode, setDiffMode,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
