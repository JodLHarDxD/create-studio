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
              className="w-[640px] overflow-hidden pointer-events-auto"
              style={{
                background: 'linear-gradient(160deg, #111111 0%, #0a0a0a 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 0 0 1px rgba(245,158,11,0.08), 0 24px 48px rgba(0,0,0,0.9), 0 8px 16px rgba(0,0,0,0.6)',
              }}
            >
              {/* Search input */}
              <div
                className="flex items-center gap-3.5 px-5 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Search size={15} style={{ color: '#f59e0b', opacity: 0.7, flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Search commands, files, tasks…"
                  className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-white/20"
                  style={{
                    color: '#f7f3ee',
                    fontFamily: '"DM Sans", sans-serif',
                    fontWeight: 400,
                  }}
                />
                <kbd
                  className="text-[10px] px-1.5 py-0.5 font-mono opacity-25 shrink-0"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3 }}
                >
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 380 }}>
                {filtered.length === 0 ? (
                  <div className="px-5 py-10 text-center" style={{ color: '#5e5855', fontSize: 13 }}>
                    No commands found for "{query}"
                  </div>
                ) : (
                  Object.entries(grouped).map(([group, cmds]) => (
                    <div key={group} className="py-1">
                      <div
                        className="px-5 pt-3 pb-1.5 font-display"
                        style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855' }}
                      >
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
                            className="w-full flex items-center gap-3.5 px-5 py-2.5 text-left transition-all duration-100"
                            style={{
                              background: isActive ? 'rgba(245,158,11,0.07)' : 'transparent',
                              borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                              borderRight: '2px solid transparent',
                            }}
                          >
                            <span className="shrink-0" style={{ color: isActive ? '#f59e0b' : '#5e5855', transition: 'color 0.1s' }}>
                              {cmd.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div
                                className="truncate"
                                style={{ fontSize: 13, color: isActive ? '#f7f3ee' : '#a09590', fontWeight: isActive ? 500 : 400 }}
                              >
                                {cmd.label}
                              </div>
                              {cmd.description && (
                                <div className="truncate" style={{ fontSize: 11, color: '#3a3836', marginTop: 1 }}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd
                                className="text-[10px] px-1.5 py-0.5 font-mono shrink-0"
                                style={{
                                  border: `1px solid ${isActive ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                  borderRadius: 3,
                                  color: isActive ? '#f59e0b' : '#5e5855',
                                }}
                              >
                                {cmd.shortcut}
                              </kbd>
                            )}
                            {isActive && (
                              <ChevronRight size={12} style={{ color: '#f59e0b', opacity: 0.5, flexShrink: 0 }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center gap-5 px-5 py-2.5"
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 10,
                  color: '#3a3836',
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 9, color: '#5e5855', letterSpacing: '0.05em' }}>CREAT</span>
                  <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 300, fontSize: 8, color: '#f59e0b', opacity: 0.5, letterSpacing: '0.02em' }}>studio</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
