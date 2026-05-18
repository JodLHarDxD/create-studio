import React, { useState, useEffect, useCallback } from 'react';
import { FileCode, BarChart3, UserCircle, LogOut, Command, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import Explorer from '../explorer/Explorer';
import EditorPanel from '../editor/EditorPanel';
import ChatPanel from '../chat/ChatPanel';
import Dashboard from '../dashboard/Dashboard';
import Login from '../auth/Login';
import Profile from '../profile/Profile';
import TeamPage from '../team/TeamPage';
import DiffViewer from '../tasks/DiffViewer';
import CommandPalette from '../ui/CommandPalette';
import NewTaskModal from '../tasks/NewTaskModal';
import { motion, AnimatePresence } from 'motion/react';
import { variants, transitions } from '@/design';

const NAV = [
  { v: 'editor'    as const, icon: FileCode,   label: 'Editor',    shortcut: 'E' },
  { v: 'dashboard' as const, icon: BarChart3,  label: 'Analytics', shortcut: 'D' },
  { v: 'team'      as const, icon: Users,      label: 'Team',      shortcut: 'T' },
  { v: 'profile'   as const, icon: UserCircle, label: 'Profile',   shortcut: 'P' },
] as const;

export default function Shell() {
  const { view, setView, loginState, logout, userRole, profile, diffTask } = useWorkspace();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const isSidebarOpen = true;
  const isChatOpen = true;

  // ── Cmd+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(p => !p);
      }
      // Cmd+N → new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && userRole === 'ADMIN') {
        e.preventDefault();
        setNewTaskOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [userRole]);

  if (loginState === 'logged_out') return <Login />;

  const initials = profile?.full_name?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ background: 'var(--surface-1)', color: 'var(--text-1)', fontFamily: '"DM Sans", sans-serif' }}
    >
      {/* ═══════════════════════════════════════════════
          ACTIVITY BAR
      ═══════════════════════════════════════════════ */}
      <div
        className="flex flex-col items-center py-4 gap-1 z-20 shrink-0"
        style={{
          width: 48,
          background: '#030303',
          borderRight: '1px solid var(--border-1)',
        }}
      >
        {/* Logo — CREATstudio wordmark mark, triggers command palette */}
        <button
          onClick={() => setCmdOpen(true)}
          title="CREATstudio — Command Palette (⌘K)"
          className="mb-5 flex flex-col items-center justify-center relative group"
          style={{ width: 32, lineHeight: 1, gap: 0 }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.12), transparent 70%)' }}
          />
          <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 11, letterSpacing: '-0.02em', color: '#f7f3ee', lineHeight: 1 }}>CR</span>
          <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 300, fontSize: 7.5, letterSpacing: '0.04em', color: '#f59e0b', lineHeight: 1, opacity: 0.8 }}>st</span>
        </button>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-0.5 flex-1">
          {NAV.map(({ v, icon: Icon, label }) => {
            const isActive = view === v && !diffTask;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                title={`${label} (⌘${v[0].toUpperCase()})`}
                className="relative w-10 h-10 flex items-center justify-center group"
              >
                {/* Icon container — active state via background tint + color, no side stripe */}
                <motion.div
                  className="w-9 h-9 flex items-center justify-center rounded transition-all duration-200"
                  style={{
                    background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(245,158,11,0.18)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(245,158,11,0.12)' : 'transparent'; }}
                >
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{
                      opacity: isActive ? 1 : 0.3,
                      color: isActive ? '#f59e0b' : '#f7f3ee',
                      transition: 'opacity 0.15s, color 0.15s',
                    }}
                  />
                </motion.div>
              </button>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="flex flex-col items-center gap-2.5 pb-2">
          {/* Cmd shortcut hint */}
          <button
            onClick={() => setCmdOpen(true)}
            title="Command Palette (⌘K)"
            className="w-8 h-8 flex items-center justify-center transition-opacity duration-200"
            style={{ opacity: 0.18 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.18')}
          >
            <Command size={13} />
          </button>

          {/* User avatar */}
          {profile && (
            <div
              className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold"
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1.5px solid rgba(245,158,11,0.35)',
                color: '#f59e0b',
                fontFamily: '"Syne", sans-serif',
                fontWeight: 700,
              }}
              title={profile.full_name}
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            className="w-8 h-8 flex items-center justify-center transition-all duration-200"
            style={{ opacity: 0.18, color: '#f7f3ee' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.18'; e.currentTarget.style.color = '#f7f3ee'; }}
          >
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MAIN LAYOUT
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden" style={{ paddingBottom: 28 }}>
        {/* Sidebar — Explorer */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 260 }}
              exit={{ width: 0 }}
              className="overflow-hidden flex flex-col shrink-0"
              style={{ background: '#080808', borderRight: '1px solid var(--border-1)' }}
            >
              <Explorer onNewTask={() => setNewTaskOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={diffTask ? 'diff' : view}
              variants={variants.fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 flex flex-col min-h-0"
            >
              {diffTask ? (
                <DiffViewer />
              ) : view === 'editor' ? (
                <div className="flex-1 flex flex-col min-h-0" style={{ background: '#1e1e1e' }}>
                  <EditorPanel />
                </div>
              ) : view === 'dashboard' ? (
                <Dashboard />
              ) : view === 'team' ? (
                <TeamPage />
              ) : (
                <Profile />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Chat panel */}
        <AnimatePresence initial={false}>
          {isChatOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 360 }}
              exit={{ width: 0 }}
              className="overflow-hidden flex flex-col shrink-0"
              style={{ background: '#080808', borderLeft: '1px solid var(--border-1)' }}
            >
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════
          STATUS BAR
      ═══════════════════════════════════════════════ */}
      <div
        className="fixed bottom-0 w-full z-30 flex items-center px-5"
        style={{
          height: 28,
          background: '#030303',
          borderTop: '1px solid var(--border-1)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full amber-pulse"
              style={{ background: '#f59e0b' }}
            />
            <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 9, letterSpacing: '0.1em', color: '#f7f3ee' }}>
              CREAT
            </span>
            <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 300, fontSize: 8, letterSpacing: '0.06em', color: '#f59e0b', opacity: 0.8, marginLeft: -1 }}>
              studio
            </span>
          </div>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span style={{ color: 'var(--text-3)' }}>
            {userRole}
          </span>
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-5" style={{ color: 'var(--text-3)' }}>
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1.5 transition-colors duration-150"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <Command size={9} />
            <span>⌘K</span>
          </button>
          <span>Supabase</span>
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#4ade80' }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          COMMAND PALETTE
      ═══════════════════════════════════════════════ */}
      <CommandPalette
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNewTask={() => setNewTaskOpen(true)}
        onOpenFolder={() => {}}
      />
      <NewTaskModal isOpen={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}
