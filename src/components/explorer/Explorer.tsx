import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, FolderOpen, X, Folder, CloudUpload, Loader2, Radio } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import TaskDetail from '../tasks/TaskDetail';
import { supabase, Task, LocalFileView } from '@/lib/supabaseClient';

// ─── File tree types ──────────────────────────────────────────────────────────

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'dir';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.cache', 'coverage', '.svelte-kit', 'out']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep']);

async function readDir(handle: FileSystemDirectoryHandle, base = ''): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for await (const [name, entry] of (handle as any).entries()) {
    if (SKIP_FILES.has(name)) continue;
    const path = base ? `${base}/${name}` : name;
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(name)) continue;
      const children = await readDir(entry as FileSystemDirectoryHandle, path);
      nodes.push({ id: path, name, path, type: 'dir', handle: entry, children });
    } else {
      nodes.push({ id: path, name, path, type: 'file', handle: entry, children: undefined });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function getMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    pdf: 'application/pdf',
  };
  return map[ext] || 'text/plain';
}

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const textExts = new Set([
    'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'cs',
    'css', 'scss', 'sass', 'less', 'html', 'htm', 'json', 'yaml', 'yml', 'md',
    'mdx', 'sql', 'sh', 'bash', 'zsh', 'toml', 'txt', 'xml', 'env', 'ini',
    'cfg', 'rb', 'php', 'swift', 'kt', 'dart', 'vue', 'svelte', 'astro',
    'lock', 'config', 'gitignore', 'dockerfile', 'makefile', 'r', 'lua',
  ]);
  return textExts.has(ext) || !name.includes('.');
}

async function readFileContent(handle: FileSystemFileHandle, name: string): Promise<Omit<LocalFileView, 'path' | 'handle'>> {
  const file = await handle.getFile();
  const mimeType = file.type || getMimeType(name);
  if (isTextFile(name)) {
    const content = await file.text();
    return { name, content, mimeType, lastModified: file.lastModified };
  }
  const objectUrl = URL.createObjectURL(file);
  return { name, content: '', objectUrl, mimeType, lastModified: file.lastModified };
}

// Count changed files recursively for folder badges
function countChangedInNode(nodes: FileNode[], changedPaths: Set<string>): number {
  return nodes.reduce((sum, node) => {
    if (node.type === 'file') return sum + (changedPaths.has(node.path) ? 1 : 0);
    return sum + countChangedInNode(node.children ?? [], changedPaths);
  }, 0);
}

// ─── File icon dot color by extension ────────────────────────────────────────

function FileColorDot({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const color: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f7df1e', jsx: '#61dafb',
    py: '#3572a5', rs: '#dea584', go: '#00acd7', java: '#b07219',
    css: '#563d7c', scss: '#c6538c', html: '#e34c26', json: '#292929',
    md: '#aaaaaa', sql: '#e38c00', sh: '#89e051', yaml: '#cb171e', yml: '#cb171e',
    png: '#4ec9b0', jpg: '#4ec9b0', jpeg: '#4ec9b0', gif: '#4ec9b0',
    svg: '#ffb13b', mp3: '#c586c0', mp4: '#c586c0', wav: '#c586c0', pdf: '#f44336',
  };
  return (
    <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color[ext] || '#858585' }} />
  );
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

function FileTreeItem({
  node, depth, activeFilePath, onFileClick, changedPaths,
}: {
  node: FileNode;
  depth: number;
  activeFilePath: string | undefined;
  onFileClick: (node: FileNode) => void;
  changedPaths: Set<string>;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'dir') {
    const changedCount = countChangedInNode(node.children ?? [], changedPaths);
    return (
      <div>
        <div
          className="flex items-center gap-1.5 cursor-pointer select-none transition-colors"
          style={{ paddingLeft: `${depth * 12 + 6}px`, paddingTop: 3, paddingBottom: 3 }}
          onClick={() => setExpanded(p => !p)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {expanded ? <ChevronDown size={11} className="shrink-0" style={{ color: '#5e5855' }} /> : <ChevronRight size={11} className="shrink-0" style={{ color: '#5e5855' }} />}
          <Folder size={12} className="shrink-0" style={{ color: '#f59e0b', opacity: 0.6 }} />
          <span className="truncate flex-1" style={{ fontSize: 11, color: '#a09590', fontFamily: '"DM Sans", sans-serif' }}>{node.name}</span>
          {changedCount > 0 && (
            <span className="mr-2 font-mono" style={{ fontSize: 9, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '0 5px', borderRadius: 2 }}>
              {changedCount}
            </span>
          )}
        </div>
        {expanded && node.children?.map(child => (
          <FileTreeItem key={child.id} node={child} depth={depth + 1} activeFilePath={activeFilePath} onFileClick={onFileClick} changedPaths={changedPaths} />
        ))}
      </div>
    );
  }

  const isActive = node.path === activeFilePath;
  const isChanged = changedPaths.has(node.path);
  return (
    <button
      onClick={() => onFileClick(node)}
      className="w-full flex items-center gap-1.5 text-left outline-none transition-colors"
      style={{
        paddingLeft: `${depth * 12 + 22}px`, paddingTop: 3, paddingBottom: 3,
        background: isActive ? 'rgba(245,158,11,0.06)' : 'transparent',
        borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <FileColorDot name={node.name} />
      <span className="truncate flex-1" style={{ fontSize: 11, color: isChanged ? '#f59e0b' : isActive ? '#f7f3ee' : '#a09590', fontFamily: '"DM Sans", sans-serif' }}>{node.name}</span>
      {isChanged && <span className="mr-2" style={{ fontSize: 9, color: 'rgba(245,158,11,0.5)', fontFamily: '"JetBrains Mono", monospace' }}>M</span>}
    </button>
  );
}

// ─── Main Explorer ────────────────────────────────────────────────────────────

export default function Explorer({ onNewTask }: { onNewTask: () => void }) {
  const {
    activeProject, tasks, currentUserId, users, userRole,
    setTasks, refetchTasks, loginState,
    localActiveFile, setLocalActiveFile,
    setDiffTask, setDiffMode,
  } = useWorkspace();

  const [taskFilter, setTaskFilter] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Local folder state
  const [localDirHandle, setLocalDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [localExpanded, setLocalExpanded] = useState(true);

  // Live sync state
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [totalFiles, setTotalFiles] = useState(0);
  const [folderError, setFolderError] = useState('');
  const lastModifiedMapRef = useRef<Map<string, number>>(new Map());
  const manifestRef = useRef<Record<string, string>>({});
  const isUploadingRef = useRef(false);
  const changedPathsRef = useRef<Set<string>>(new Set());

  const isAdmin = userRole === 'ADMIN';
  const visibleTasks = isAdmin ? tasks : tasks.filter(t => t.assignee_id === currentUserId);
  const filteredTasks = visibleTasks.filter(t => {
    if (taskFilter === 'TODO') return t.status !== 'DONE';
    if (taskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  // Task eligible for sync: member's assigned task with a ZIP (TODO or IN_PROGRESS)
  const syncCandidateTask = useMemo(() => {
    if (!localDirHandle || linkedTaskId || isAdmin) return null;
    return visibleTasks.find(t =>
      (t.status === 'TODO' || t.status === 'IN_PROGRESS') &&
      t.original_zip_path &&
      t.assignee_id === currentUserId
    ) ?? null;
  }, [localDirHandle, linkedTaskId, isAdmin, visibleTasks, currentUserId]);

  // Local progress for the currently linked task (reactive, no DB roundtrip)
  const localProgress = useMemo(() => {
    if (!linkedTaskId || totalFiles === 0) return 0;
    return Math.round((changedPaths.size / totalFiles) * 100);
  }, [linkedTaskId, totalFiles, changedPaths]);

  // ── Open local folder ──
  const openFolder = async () => {
    if (!(window as any).showDirectoryPicker) {
      setFolderError('Requires Chrome or Edge browser.');
      return;
    }
    setFolderError('');
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      // Reset all previous folder state before mounting the new one
      if (localActiveFile?.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
      setLocalActiveFile(null);
      setLinkedTaskId(null);
      setChangedPaths(new Set());
      changedPathsRef.current = new Set();
      lastModifiedMapRef.current = new Map();
      manifestRef.current = {};
      setTotalFiles(0);
      setLocalDirHandle(handle);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setFolderError('Could not open folder. Check browser permissions.');
      }
    }
  };

  const closeFolder = () => {
    if (localActiveFile?.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
    setLocalDirHandle(null);
    setFileTree([]);
    setLocalActiveFile(null);
    setLinkedTaskId(null);
    setChangedPaths(new Set());
    changedPathsRef.current = new Set();
    lastModifiedMapRef.current = new Map();
    manifestRef.current = {};
    setTotalFiles(0);
    setFolderError('');
  };

  // ── Link folder to task + initial manifest upload ──
  const linkToTask = async (task: Task) => {
    if (!localDirHandle || syncing) return;
    setSyncing(true);
    setSyncStatus('Reading files…');

    try {
      const manifest: Record<string, string> = {};
      const modMap = new Map<string, number>();

      async function traverse(handle: FileSystemDirectoryHandle, base: string) {
        for await (const [name, entry] of (handle as any).entries()) {
          if (SKIP_FILES.has(name)) continue;
          const path = base ? `${base}/${name}` : name;
          if (entry.kind === 'directory') {
            if (SKIP_DIRS.has(name)) continue;
            await traverse(entry as FileSystemDirectoryHandle, path);
          } else if (isTextFile(name)) {
            const file = await (entry as FileSystemFileHandle).getFile();
            manifest[path] = await file.text();
            modMap.set(path, file.lastModified);
          }
        }
      }

      await traverse(localDirHandle, '');
      setSyncStatus('Uploading…');

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const { error } = await supabase.storage.from('task-files').upload(
        `tasks/${task.id}/live-manifest.json`,
        blob,
        { upsert: true, contentType: 'application/json' },
      );
      if (error) throw error;

      const fileCount = Object.keys(manifest).length;
      lastModifiedMapRef.current = modMap;
      manifestRef.current = manifest;
      changedPathsRef.current = new Set();
      setChangedPaths(new Set());
      setTotalFiles(fileCount);
      setLinkedTaskId(task.id);
      setSyncStatus(`Linked · ${fileCount} files`);

      // Auto-mark as IN_PROGRESS when folder is first linked
      if (task.status === 'TODO' && loginState !== 'guest') {
        await supabase.from('tasks').update({ status: 'IN_PROGRESS', progress: 0 }).eq('id', task.id);
        await refetchTasks();
      } else if (loginState !== 'guest') {
        await supabase.from('tasks').update({ progress: 0 }).eq('id', task.id).then(() => {});
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
      setSyncStatus('');
    } finally {
      setSyncing(false);
    }
  };

  // ── Detect + upload changed files ──
  const syncChanges = useCallback(async (taskId: string) => {
    if (!localDirHandle || isUploadingRef.current) return;

    const prevModMap = lastModifiedMapRef.current;
    const manifest = { ...manifestRef.current };
    const newModMap = new Map(prevModMap);
    const newChanged = new Set(changedPathsRef.current);
    let anyChanged = false;

    async function traverseCheck(handle: FileSystemDirectoryHandle, base: string) {
      for await (const [name, entry] of (handle as any).entries()) {
        if (SKIP_FILES.has(name)) continue;
        const path = base ? `${base}/${name}` : name;
        if (entry.kind === 'directory') {
          if (SKIP_DIRS.has(name)) continue;
          await traverseCheck(entry as FileSystemDirectoryHandle, path);
        } else if (isTextFile(name)) {
          const file = await (entry as FileSystemFileHandle).getFile();
          const prev = prevModMap.get(path);
          if (prev === undefined || file.lastModified > prev) {
            manifest[path] = await file.text();
            newModMap.set(path, file.lastModified);
            newChanged.add(path);
            anyChanged = true;
          }
        }
      }
    }

    await traverseCheck(localDirHandle, '');

    if (anyChanged) {
      isUploadingRef.current = true;
      try {
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        await supabase.storage.from('task-files').upload(
          `tasks/${taskId}/live-manifest.json`,
          blob,
          { upsert: true, contentType: 'application/json' },
        );
        lastModifiedMapRef.current = newModMap;
        manifestRef.current = manifest;
        changedPathsRef.current = newChanged;
        setChangedPaths(new Set(newChanged));

        // Compute progress and push to DB (non-blocking)
        const total = Object.keys(manifest).length;
        const progress = total > 0 ? Math.round((newChanged.size / total) * 100) : 0;
        setTotalFiles(total);
        if (loginState !== 'guest') {
          supabase.from('tasks').update({ progress }).eq('id', taskId).then(() => {});
        }
        setSyncStatus(`Synced · ${newChanged.size}/${total} changed`);
      } finally {
        isUploadingRef.current = false;
      }
    }
  }, [localDirHandle, loginState]);

  // ── Read directory & poll for changes ──
  const refreshTree = useCallback(async () => {
    if (!localDirHandle) return;
    try {
      const tree = await readDir(localDirHandle);
      setFileTree(tree);
      if (linkedTaskId) await syncChanges(linkedTaskId);
    } catch { /* permission revoked */ }
  }, [localDirHandle, linkedTaskId, syncChanges]);

  useEffect(() => {
    if (!localDirHandle) return;
    refreshTree();
    const id = setInterval(refreshTree, 3000);
    return () => clearInterval(id);
  }, [refreshTree]);

  // ── Poll active file for changes ──
  useEffect(() => {
    if (!localActiveFile) return;
    const id = setInterval(async () => {
      try {
        const file = await localActiveFile.handle.getFile();
        if (file.lastModified <= localActiveFile.lastModified) return;
        const mimeType = localActiveFile.mimeType;
        let content = '';
        let objectUrl: string | undefined;
        if (isTextFile(localActiveFile.name)) {
          content = await file.text();
          if (localActiveFile.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
        } else {
          if (localActiveFile.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
          objectUrl = URL.createObjectURL(file);
        }
        setLocalActiveFile({ ...localActiveFile, content, objectUrl, mimeType, lastModified: file.lastModified });
      } catch { /* handle gone */ }
    }, 2000);
    return () => clearInterval(id);
  }, [localActiveFile]);

  // ── File click handler ──
  const handleFileClick = async (node: FileNode) => {
    if (node.type !== 'file') return;
    try {
      const result = await readFileContent(node.handle as FileSystemFileHandle, node.name);
      if (localActiveFile?.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
      setLocalActiveFile({ ...result, path: node.path, handle: node.handle as FileSystemFileHandle });
    } catch (e) {
      console.error('Failed to read file', e);
    }
  };

  // ── Task actions ──
  const updateTask = async (taskId: string, updates: any) => {
    if (loginState === 'guest') {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      return;
    }
    await supabase.from('tasks').update(updates).eq('id', taskId);
    await refetchTasks();
  };

  const linkedTask = tasks.find(t => t.id === linkedTaskId);

  const sectionLabel = (text: string) => (
    <span style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3a3836' }}>{text}</span>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: '#a09590', fontSize: 12 }}>
      {/* Panel header */}
      <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
        {sectionLabel('Explorer')}
      </div>

      {/* ── Local Folder Section ── */}
      <div className="shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
        {!localDirHandle ? (
          <>
            <button
              onClick={openFolder}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ color: '#3a3836', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}
            >
              <FolderOpen size={12} />
              Open Local Folder
            </button>
            {folderError && (
              <div className="px-3 pb-2" style={{ fontSize: 9, color: '#f87171', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em' }}>
                {folderError}
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="flex items-center justify-between px-2 py-1.5 cursor-pointer group transition-colors"
              onClick={() => setLocalExpanded(p => !p)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {localExpanded
                  ? <ChevronDown size={11} style={{ color: '#5e5855', flexShrink: 0 }} />
                  : <ChevronRight size={11} style={{ color: '#5e5855', flexShrink: 0 }} />}
                <span className="truncate max-w-[130px]" style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', fontWeight: 600, color: '#f7f3ee', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{localDirHandle.name}</span>
                {linkedTaskId && (
                  <span className="flex items-center gap-1 shrink-0" style={{ fontSize: 8, color: '#f59e0b', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em' }}>
                    <Radio size={8} className="animate-pulse" /> live
                  </span>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); closeFolder(); }}
                className="opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                style={{ color: '#5e5855' }}
                title="Close folder"
              >
                <X size={10} />
              </button>
            </div>

            {/* Sync banner — shown when member opens a folder and has a relevant task */}
            {!linkedTaskId && syncCandidateTask && (
              <div className="mx-2 mb-1.5 px-3 py-2 flex items-center gap-2" style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
                <CloudUpload size={10} style={{ color: '#f59e0b', flexShrink: 0, opacity: 0.7 }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 9, color: '#f59e0b', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em' }}>
                    {syncCandidateTask.title}
                  </div>
                  <div style={{ fontSize: 8, color: '#5e5855', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', marginTop: 2 }}>
                    {syncCandidateTask.status === 'TODO' ? 'link folder → starts task' : 'link folder → sync progress'}
                  </div>
                </div>
                <button
                  onClick={() => linkToTask(syncCandidateTask)}
                  disabled={syncing}
                  className="shrink-0 transition-all"
                  style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px' }}
                >
                  {syncing ? <Loader2 size={9} className="animate-spin" /> : syncCandidateTask.status === 'TODO' ? 'Start' : 'Link'}
                </button>
              </div>
            )}

            {/* Linked task status */}
            {linkedTask && syncStatus && (
              <div className="mx-2 mb-1 flex items-center gap-1.5 px-1" style={{ fontSize: 9, color: '#f59e0b', fontFamily: '"JetBrains Mono", monospace' }}>
                <Radio size={8} className="animate-pulse shrink-0" />
                <span className="truncate">{syncStatus}</span>
              </div>
            )}

            {localExpanded && (
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '45vh' }}>
                {fileTree.length === 0 && (
                  <div className="px-6 py-3" style={{ fontSize: 10, color: '#3a3836', fontStyle: 'italic' }}>Empty folder</div>
                )}
                {fileTree.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    activeFilePath={localActiveFile?.path}
                    onFileClick={handleFileClick}
                    changedPaths={changedPaths}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Tasks Section ── */}
      <div className="mt-0 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div
          className="flex items-center justify-between px-2 py-1.5 cursor-pointer group shrink-0 transition-colors"
          onClick={() => setTasksExpanded(p => !p)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <div className="flex items-center gap-1.5">
            {tasksExpanded ? <ChevronDown size={11} style={{ color: '#5e5855' }} /> : <ChevronRight size={11} style={{ color: '#5e5855' }} />}
            {sectionLabel('Tasks')}
            <span style={{ fontSize: 9, color: '#3a3836', fontFamily: '"JetBrains Mono", monospace' }}>({filteredTasks.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onNewTask(); }}
              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#f59e0b' }}
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        {tasksExpanded && (
          <>
            <div className="flex gap-3 px-4 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
              {(['ALL', 'TODO', 'DONE'] as const).map(f => (
                <button key={f} onClick={() => setTaskFilter(f)}
                  style={{
                    fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase',
                    color: taskFilter === f ? '#f59e0b' : '#3a3836',
                    borderBottom: taskFilter === f ? '1px solid #f59e0b' : '1px solid transparent',
                    paddingBottom: 1,
                  }}>
                  {f}
                </button>
              ))}
            </div>

            <div className="flex flex-col">
              <LayoutGroup>
                <AnimatePresence initial={false}>
                  {filteredTasks.map(task => {
                    const isMine = task.assignee_id === currentUserId;
                    const isUnassigned = !task.assignee_id;
                    const assignee = users.find(u => u.id === task.assignee_id);
                    const isInProgress = task.status === 'IN_PROGRESS';

                    const statusDot = task.status === 'DONE'
                      ? { bg: '#4ade80' }
                      : isInProgress
                      ? { bg: '#f59e0b' }
                      : { bg: 'transparent', border: '1px solid #3a3836' };

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col px-4 py-2 group transition-colors"
                        style={{ borderBottom: '1px solid var(--border-1)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 mt-1.5 rounded-sm shrink-0" style={{ background: statusDot.bg, border: (statusDot as any).border }} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setDetailTask(task)}
                                className="truncate text-left transition-colors"
                                style={{ fontSize: 11, color: task.status === 'DONE' ? '#3a3836' : '#a09590', textDecoration: task.status === 'DONE' ? 'line-through' : 'none', fontFamily: '"DM Sans", sans-serif' }}
                                onMouseEnter={e => { if (task.status !== 'DONE') (e.currentTarget as HTMLElement).style.color = '#f7f3ee'; }}
                                onMouseLeave={e => { if (task.status !== 'DONE') (e.currentTarget as HTMLElement).style.color = '#a09590'; }}
                              >
                                {task.title}
                              </button>
                              {isAdmin && isInProgress && task.original_zip_path && (
                                <button
                                  onClick={() => { setDiffMode('live'); setDiffTask(task); }}
                                  className="shrink-0 transition-all"
                                  style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '1px 5px' }}
                                  title="View live changes"
                                >
                                  Live
                                </button>
                              )}
                            </div>
                            {task.description && <span className="line-clamp-1 mt-0.5" style={{ fontSize: 10, color: '#3a3836', fontFamily: '"DM Sans", sans-serif' }}>{task.description}</span>}
                            {assignee && (
                              <div className="flex items-center gap-1 mt-1">
                                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 9, color: '#f59e0b', fontFamily: '"Syne", sans-serif', fontWeight: 700 }}>
                                  {assignee.full_name[0]}
                                </div>
                                <span style={{ fontSize: 9, color: '#3a3836', fontFamily: '"JetBrains Mono", monospace' }}>{assignee.full_name}</span>
                              </div>
                            )}

                            {/* Progress bar — shown for IN_PROGRESS tasks with a ZIP attached */}
                            {task.status === 'IN_PROGRESS' && task.original_zip_path && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                                  <div
                                    className="h-full transition-all duration-700"
                                    style={{
                                      width: `${linkedTaskId === task.id ? localProgress : (task.progress ?? 0)}%`,
                                      background: 'rgba(245,158,11,0.55)',
                                      borderRadius: 1,
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: '#5e5855', minWidth: 26, textAlign: 'right' }}>
                                  {linkedTaskId === task.id ? localProgress : (task.progress ?? 0)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pl-3.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                          {isAdmin && (
                            <select value={task.assignee_id || ''} onChange={e => updateTask(task.id, { assignee_id: e.target.value || null })}
                              className="outline-none transition-colors"
                              style={{ background: '#0a0a0a', border: '1px solid var(--border-2)', fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5e5855', padding: '1px 4px' }}>
                              <option value="">Unassigned</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                          )}
                          {isAdmin && (
                            <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value })}
                              className="outline-none"
                              style={{ background: '#0a0a0a', border: '1px solid var(--border-2)', fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5e5855', padding: '1px 4px' }}>
                              <option value="TODO">TODO</option>
                              <option value="IN_PROGRESS">IN PROGRESS</option>
                              <option value="DONE">DONE</option>
                            </select>
                          )}
                          {!isAdmin && isUnassigned && task.status !== 'DONE' && (
                            <button onClick={() => updateTask(task.id, { assignee_id: currentUserId, status: 'IN_PROGRESS' })}
                              style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px' }}>
                              Take Task
                            </button>
                          )}
                          {!isAdmin && isMine && task.status === 'IN_PROGRESS' && (
                            <button onClick={() => updateTask(task.id, { status: 'DONE' })}
                              style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', padding: '2px 8px' }}>
                              Mark Done
                            </button>
                          )}
                          {!isAdmin && isMine && task.status === 'TODO' && (
                            <button onClick={() => updateTask(task.id, { status: 'IN_PROGRESS' })}
                              style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px' }}>
                              Start
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </LayoutGroup>
              {filteredTasks.length === 0 && (
                <div className="px-4 py-5" style={{ fontSize: 10, color: '#3a3836', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No tasks</div>
              )}
            </div>
          </>
        )}
      </div>

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onViewDiff={t => { setDetailTask(null); }}
        />
      )}
    </div>
  );
}
