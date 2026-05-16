import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, FolderOpen, X, Folder } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import NewTaskModal from '../tasks/NewTaskModal';
import { supabase } from '@/lib/supabaseClient';
import { LocalFileView } from '@/lib/supabaseClient';

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
    svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp',
    avif: 'image/avif',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    m4a: 'audio/mp4', aac: 'audio/aac',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', mkv: 'video/x-matroska',
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

// ─── File icon dot color by extension ────────────────────────────────────────

function FileColorDot({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const color: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f7df1e', jsx: '#61dafb',
    py: '#3572a5', rs: '#dea584', go: '#00acd7', java: '#b07219',
    css: '#563d7c', scss: '#c6538c', html: '#e34c26', json: '#292929',
    md: '#aaaaaa', sql: '#e38c00', sh: '#89e051', yaml: '#cb171e', yml: '#cb171e',
    png: '#4ec9b0', jpg: '#4ec9b0', jpeg: '#4ec9b0', gif: '#4ec9b0',
    svg: '#ffb13b', mp3: '#c586c0', mp4: '#c586c0', wav: '#c586c0',
    pdf: '#f44336',
  };
  return (
    <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color[ext] || '#858585' }} />
  );
}

// ─── Recursive tree node ──────────────────────────────────────────────────────

function FileTreeItem({
  node, depth, activeFilePath, onFileClick,
}: {
  node: FileNode;
  depth: number;
  activeFilePath: string | undefined;
  onFileClick: (node: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'dir') {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 py-[3px] hover:bg-[#2a2d2e] cursor-pointer select-none"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          onClick={() => setExpanded(p => !p)}
        >
          {expanded ? <ChevronDown size={12} className="shrink-0 opacity-60" /> : <ChevronRight size={12} className="shrink-0 opacity-60" />}
          <Folder size={13} className="shrink-0 text-[#e8ab5f]" />
          <span className="text-[12px] text-[#cccccc] truncate">{node.name}</span>
        </div>
        {expanded && node.children?.map(child => (
          <FileTreeItem key={child.id} node={child} depth={depth + 1} activeFilePath={activeFilePath} onFileClick={onFileClick} />
        ))}
      </div>
    );
  }

  const isActive = node.path === activeFilePath;
  return (
    <button
      onClick={() => onFileClick(node)}
      className={cn(
        'w-full flex items-center gap-1.5 py-[3px] text-left text-[12px] outline-none',
        isActive ? 'bg-[#37373d] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]',
      )}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <FileColorDot name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ─── Main Explorer ────────────────────────────────────────────────────────────

export default function Explorer() {
  const {
    activeProject, tasks, currentUserId, users, userRole,
    setTasks, refetchTasks, loginState,
    localActiveFile, setLocalActiveFile,
  } = useWorkspace();

  const [taskFilter, setTaskFilter] = useState<'ALL' | 'TODO' | 'DONE'>('ALL');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);

  // Local folder state
  const [localDirHandle, setLocalDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [localExpanded, setLocalExpanded] = useState(true);

  const isAdmin = userRole === 'ADMIN';

  const visibleTasks = isAdmin ? tasks : tasks.filter(t => t.assignee_id === currentUserId);
  const filteredTasks = visibleTasks.filter(t => {
    if (taskFilter === 'TODO') return t.status !== 'DONE';
    if (taskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  // ── Open local folder ──
  const openFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' });
      setLocalDirHandle(handle);
    } catch { /* user cancelled */ }
  };

  const closeFolder = () => {
    if (localActiveFile?.objectUrl) URL.revokeObjectURL(localActiveFile.objectUrl);
    setLocalDirHandle(null);
    setFileTree([]);
    setLocalActiveFile(null);
  };

  // ── Read directory & poll for changes ──
  const refreshTree = useCallback(async () => {
    if (!localDirHandle) return;
    try {
      const tree = await readDir(localDirHandle);
      setFileTree(tree);
    } catch { /* permission revoked */ }
  }, [localDirHandle]);

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

  return (
    <div className="flex flex-col h-full text-[13px] font-sans text-[#cccccc] overflow-hidden">
      <div className="px-4 py-2 text-[10px] uppercase tracking-widest font-black text-white/40 shrink-0">Explorer</div>

      {/* ── Local Folder Section ── */}
      <div className="shrink-0 border-b border-[#2d2d2d]">
        {!localDirHandle ? (
          <button
            onClick={openFolder}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-[#858585] hover:text-white hover:bg-[#2a2d2e] transition-colors"
          >
            <FolderOpen size={13} />
            Open Local Folder
          </button>
        ) : (
          <>
            <div
              className="flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group"
              onClick={() => setLocalExpanded(p => !p)}
            >
              <div className="flex items-center gap-1 font-bold">
                {localExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="uppercase text-[10px] tracking-wider truncate max-w-[160px]">{localDirHandle.name}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); closeFolder(); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#555] rounded"
                title="Close folder"
              >
                <X size={11} />
              </button>
            </div>
            {localExpanded && (
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '45vh' }}>
                {fileTree.length === 0 && (
                  <div className="px-6 py-3 text-[10px] opacity-30 italic">Empty folder</div>
                )}
                {fileTree.map(node => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    activeFilePath={localActiveFile?.path}
                    onFileClick={handleFileClick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Tasks Section ── */}
      <div className="mt-1 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div
          className="flex items-center justify-between px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group shrink-0"
          onClick={() => setTasksExpanded(p => !p)}
        >
          <div className="flex items-center gap-1 font-bold">
            {tasksExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="uppercase text-[10px] tracking-wider">Tasks</span>
            <span className="text-[9px] opacity-30 ml-1">({filteredTasks.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); setIsTaskModalOpen(true); }}
              className="p-1 hover:bg-[#333] rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {tasksExpanded && (
          <>
            <div className="flex gap-2 px-6 mb-2 mt-1 shrink-0">
              {(['ALL', 'TODO', 'DONE'] as const).map(f => (
                <button key={f} onClick={() => setTaskFilter(f)}
                  className={cn('text-[9px] uppercase tracking-wider px-1',
                    taskFilter === f ? 'text-white border-b border-white' : 'text-[#858585] hover:text-[#cccccc]')}>
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

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="flex flex-col pl-6 pr-2 py-1.5 hover:bg-[#2a2d2e] group border-b border-white/3"
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn('w-2 h-2 mt-1.5 rounded-sm shrink-0',
                            task.status === 'DONE' ? 'bg-green-500' : task.status === 'IN_PROGRESS' ? 'bg-[#007acc]' : 'border border-[#858585]')} />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('truncate text-[12px]', task.status === 'DONE' && 'text-[#858585] line-through')}>{task.title}</span>
                              {task.priority && task.priority !== 'MED' && (
                                <span className={cn('shrink-0 text-[8px] font-black uppercase tracking-wider px-1 py-px',
                                  task.priority === 'HIGH' ? 'text-red-400/80' : 'text-green-400/60')}>
                                  {task.priority}
                                </span>
                              )}
                            </div>
                            {task.description && <span className="text-[10px] text-[#858585] line-clamp-1 mt-0.5">{task.description}</span>}
                            {assignee && (
                              <div className="flex items-center gap-1 mt-1">
                                <div className="w-3.5 h-3.5 rounded-full bg-[#3c3c3c] text-white flex items-center justify-center text-[9px]">
                                  {assignee.full_name[0]}
                                </div>
                                <span className="text-[10px] text-[#858585]">{assignee.full_name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-4 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                          {isAdmin && (
                            <select value={task.assignee_id || ''} onChange={e => updateTask(task.id, { assignee_id: e.target.value || null })}
                              className="bg-[#3c3c3c] border border-[#3c3c3c] text-[10px] p-0.5 outline-none rounded">
                              <option value="">Unassigned</option>
                              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                          )}
                          {isAdmin && (
                            <select value={task.status} onChange={e => updateTask(task.id, { status: e.target.value })}
                              className="bg-[#3c3c3c] border border-[#3c3c3c] text-[10px] p-0.5 outline-none rounded">
                              <option value="TODO">TODO</option>
                              <option value="IN_PROGRESS">IN PROGRESS</option>
                              <option value="DONE">DONE</option>
                            </select>
                          )}
                          {!isAdmin && isUnassigned && task.status !== 'DONE' && (
                            <button onClick={() => updateTask(task.id, { assignee_id: currentUserId, status: 'IN_PROGRESS' })}
                              className="text-[10px] bg-[#007acc] text-white px-2 py-0.5 rounded">Take Task</button>
                          )}
                          {!isAdmin && isMine && task.status === 'IN_PROGRESS' && (
                            <button onClick={() => updateTask(task.id, { status: 'DONE' })}
                              className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">Mark Done</button>
                          )}
                          {!isAdmin && isMine && task.status === 'TODO' && (
                            <button onClick={() => updateTask(task.id, { status: 'IN_PROGRESS' })}
                              className="text-[10px] border border-[#007acc] text-[#007acc] px-2 py-0.5 rounded">Start</button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </LayoutGroup>
              {filteredTasks.length === 0 && (
                <div className="pl-6 py-4 text-[10px] opacity-30 italic">No tasks</div>
              )}
            </div>
          </>
        )}
      </div>

      <NewTaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} />
    </div>
  );
}
