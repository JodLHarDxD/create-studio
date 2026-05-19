import { useState, useEffect } from 'react';
import { FileCode, BarChart3, UserCircle, LogOut, Command, Users, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import Explorer from '../explorer/Explorer';
import EditorPanel from '../editor/EditorPanel';
import TeamChatPanel from '../chat-team/TeamChatPanel';
import Dashboard from '../dashboard/Dashboard';
import Login from '../auth/Login';
import Profile from '../profile/Profile';
import TeamPage from '../team/TeamPage';
import DiffViewer from '../tasks/DiffViewer';
import CommandPalette from '../ui/CommandPalette';
import NewTaskModal from '../tasks/NewTaskModal';
import WebGLBackground from '../effects/WebGLBackground';
import { motion, AnimatePresence } from 'motion/react';
import { variants } from '@/design';

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(p => !p);
      }
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
      className="relative flex h-screen w-screen overflow-hidden text-zinc-200 antialiased"
      style={{ background: 'transparent', fontFamily: '"Inter", sans-serif' }}
    >
      {/* Cinematic ambient WebGL — sits beneath everything */}
      <WebGLBackground />

      {/* ═══════════════════════════════════════════════
          ACTIVITY RAIL — left vertical chrome
      ═══════════════════════════════════════════════ */}
      <div
        className="relative z-20 flex flex-col items-center py-5 gap-1 shrink-0 border-r border-white/[0.06] bg-zinc-950/60 backdrop-blur-xl"
        style={{ width: 56 }}
      >
        {/* Forge mark — opens command palette */}
        <button
          onClick={() => setCmdOpen(true)}
          title="FORGE — Command Palette (⌘K)"
          className="mb-6 w-10 h-10 flex items-center justify-center border border-white/[0.08] hover:border-emerald-400/40 transition-colors duration-500 group relative"
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/10 to-violet-500/10" />
          <Sparkles className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition-colors duration-500" strokeWidth={1.5} />
        </button>

        {/* Nav */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {NAV.map(({ v, icon: Icon, label }) => {
            const isActive = view === v && !diffTask;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                title={`${label} (⌘${v[0].toUpperCase()})`}
                className="relative w-10 h-10 flex items-center justify-center group"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 border border-emerald-400/30 bg-emerald-500/[0.06]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  size={17}
                  strokeWidth={isActive ? 1.8 : 1.4}
                  className={`relative z-10 transition-colors duration-300 ${
                    isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-200'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Bottom controls */}
        <div className="flex flex-col items-center gap-3 pb-2">
          <button
            onClick={() => setCmdOpen(true)}
            title="Command Palette (⌘K)"
            className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors duration-200"
          >
            <Command size={13} strokeWidth={1.5} />
          </button>

          {profile && (
            <div
              className="w-8 h-8 overflow-hidden shrink-0 flex items-center justify-center text-[10px] border border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-300"
              style={{ fontFamily: '"Playfair Display", serif', fontWeight: 500, fontStyle: 'italic' }}
              title={profile.full_name}
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : initials}
            </div>
          )}

          <button
            onClick={logout}
            title="Logout"
            aria-label="Logout"
            className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 transition-colors duration-200"
          >
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MAIN LAYOUT
      ═══════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 flex overflow-hidden" style={{ paddingBottom: 28 }}>
        {/* Explorer sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 280 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden flex flex-col shrink-0 border-r border-white/[0.06] bg-zinc-950/50 backdrop-blur-xl"
            >
              <Explorer onNewTask={() => setNewTaskOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-950/30 backdrop-blur-md">
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
                <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/40">
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
              animate={{ width: 380 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden flex flex-col shrink-0 border-l border-white/[0.06] bg-zinc-950/50 backdrop-blur-xl"
            >
              <TeamChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════
          STATUS BAR
      ═══════════════════════════════════════════════ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center px-5 border-t border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl"
        style={{ height: 28, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full amber-pulse" style={{ background: '#34d399' }} />
            <span style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 12, letterSpacing: '0.02em', color: '#f4f4f5' }}>
              forge
            </span>
            <span className="ml-1.5 text-[9px] tracking-[0.25em] uppercase text-zinc-500">
              Neural Console
            </span>
          </div>
          <span className="text-zinc-700">·</span>
          <span className="text-[9px] tracking-[0.20em] uppercase text-zinc-500">{userRole}</span>
        </div>

        <div className="ml-auto flex items-center gap-5 text-zinc-500">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors duration-200"
          >
            <Command size={9} strokeWidth={1.5} />
            <span>⌘K</span>
          </button>
          <span className="text-[9px] tracking-[0.20em] uppercase">Supabase</span>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>

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
