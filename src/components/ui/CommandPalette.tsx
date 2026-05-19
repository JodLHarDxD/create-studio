import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  FileCode, BarChart3, UserCircle, Plus, FolderOpen,
  Search, ChevronRight, CheckSquare, File, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Cmd {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNewTask: () => void;
  onOpenFolder: () => void;
}

export default function CommandPalette({ isOpen, onClose, onNewTask, onOpenFolder }: Props) {
  const { setView, tasks, files, currentUserId, userRole } = useWorkspace();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo((): Cmd[] => {
    const base: Cmd[] = [
      {
        id: 'nav-editor',
        label: 'Go to Editor',
        description: 'Open the code editor',
        group: 'Navigate',
        icon: <FileCode size={14} />,
        shortcut: '⌘E',
        action: () => { setView('editor'); onClose(); },
      },
      {
        id: 'nav-dashboard',
        label: 'Go to Analytics',
        description: 'View team metrics and charts',
        group: 'Navigate',
        icon: <BarChart3 size={14} />,
        shortcut: '⌘D',
        action: () => { setView('dashboard'); onClose(); },
      },
      {
        id: 'nav-profile',
        label: 'Go to Profile',
        description: 'Edit your profile',
        group: 'Navigate',
        icon: <UserCircle size={14} />,
        action: () => { setView('profile'); onClose(); },
      },
      {
        id: 'action-new-task',
        label: 'Create New Task',
        description: userRole === 'ADMIN' ? 'Add a task to the project' : 'Only admins can create tasks',
        group: 'Actions',
        icon: <Plus size={14} />,
        shortcut: '⌘N',
        action: () => { onNewTask(); onClose(); },
      },
      {
        id: 'action-open-folder',
        label: 'Open Local Folder',
        description: 'Browse your filesystem',
        group: 'Actions',
        icon: <FolderOpen size={14} />,
        shortcut: '⌘O',
        action: () => { setView('editor'); onOpenFolder(); onClose(); },
      },
    ];

    // IN_PROGRESS tasks
    const taskCmds: Cmd[] = tasks
      .filter(t => t.status === 'IN_PROGRESS')
      .slice(0, 4)
      .map(t => ({
        id: `task-${t.id}`,
        label: t.title,
        description: 'In Progress',
        group: 'Active Tasks',
        icon: <div className="w-2 h-2 rounded-sm" style={{ background: '#4f8ef7' }} />,
        action: () => { setView('editor'); onClose(); },
      }));

    // Recent files
    const fileCmds: Cmd[] = files.slice(0, 3).map(f => ({
      id: `file-${f.id}`,
      label: f.file_name,
      description: f.path,
      group: 'Cloud Files',
      icon: <File size={13} />,
      action: () => { setView('editor'); onClose(); },
    }));

    return [...base, ...taskCmds, ...fileCmds];
  }, [tasks, files, userRole, setView, onClose, onNewTask, onOpenFolder]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  const grouped = useMemo(() =>
    filtered.reduce<Record<string, Cmd[]>>((acc, cmd) => {
      (acc[cmd.group] = acc[cmd.group] || []).push(cmd);
      return acc;
    }, {}),
  [filtered]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(p => Math.min(p + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(p => Math.max(p - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        filtered[activeIdx]?.action();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ background: 'rgba(3,3,3,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-start justify-center pointer-events-none" style={{ paddingTop: '18vh' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.97, y: -6, filter: 'blur(2px)' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-[640px] overflow-hidden pointer-events-auto bg-zinc-950/95 backdrop-blur-2xl"
              style={{
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 0 0 1px rgba(52,211,153,0.10), 0 32px 80px rgba(0,0,0,0.8), 0 12px 28px rgba(0,0,0,0.5)',
              }}
            >
              {/* Search input */}
              <div className="flex items-center gap-3.5 px-5 py-4 border-b border-white/[0.06]">
                <Search size={15} className="text-emerald-400/80 shrink-0" strokeWidth={1.5} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Search commands, files, tasks…"
                  className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-zinc-600 text-zinc-100"
                />
                <kbd className="text-[10px] px-1.5 py-0.5 font-mono text-zinc-500 border border-white/10 shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 380 }}>
                {filtered.length === 0 ? (
                  <div className="px-5 py-10 text-center text-zinc-500 text-[13px] font-display italic">
                    No commands found for "{query}"
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, cmds]) => (
                    <div key={group} className="py-1">
                      <div className="px-5 pt-3 pb-1.5 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">
                        {group}
                      </div>
                      {cmds.map(cmd => {
                        const idx = filtered.indexOf(cmd);
                        const isActive = idx === activeIdx;
                        return (
                          <button
                            key={cmd.id}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={cmd.action}
                            className="w-full flex items-center gap-3.5 px-5 py-2.5 text-left transition-all duration-150"
                            style={{
                              background: isActive ? 'rgba(52,211,153,0.06)' : 'transparent',
                              borderLeft: isActive ? '2px solid #34d399' : '2px solid transparent',
                              borderRight: '2px solid transparent',
                            }}
                          >
                            <span
                              className="shrink-0 transition-colors duration-150"
                              style={{ color: isActive ? '#34d399' : '#71717a' }}
                            >
                              {cmd.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div
                                className="truncate text-[13px]"
                                style={{ color: isActive ? '#f4f4f5' : '#a1a1aa', fontWeight: isActive ? 500 : 400 }}
                              >
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className="truncate text-[11px] text-zinc-600 mt-0.5">
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd
                                className="text-[10px] px-1.5 py-0.5 font-mono shrink-0"
                                style={{
                                  borderColor: isActive ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.10)',
                                  borderWidth: 1,
                                  borderStyle: 'solid',
                                  color: isActive ? '#34d399' : '#71717a',
                                }}
                              >
                                {cmd.shortcut}
                              </kbd>
                            )}
                            {isActive && (
                              <ChevronRight size={12} className="text-emerald-400/70 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-5 px-5 py-2.5 border-t border-white/[0.06] text-[10px] text-zinc-500 font-mono tracking-wide">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
                <div className="ml-auto">
                  <span className="font-display italic text-zinc-200 text-[13px]">creat</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
