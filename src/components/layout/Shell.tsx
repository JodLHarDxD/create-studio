import React, { useState } from 'react';
import { FileCode, BarChart3, UserCircle, LogOut, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import Explorer from '../explorer/Explorer';
import EditorPanel from '../editor/EditorPanel';
import ChatPanel from '../chat/ChatPanel';
import Dashboard from '../dashboard/Dashboard';
import Login from '../auth/Login';
import Profile from '../profile/Profile';
import { motion, AnimatePresence } from 'motion/react';

export default function Shell() {
  const { view, setView, loginState, logout, userRole, profile } = useWorkspace();
  const [isSidebarOpen] = useState(true);
  const [isChatOpen] = useState(true);

  if (loginState === 'logged_out') return <Login />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#f5f5f4] font-sans">
      {/* Activity Bar */}
      <div className="w-14 bg-black flex flex-col items-center py-6 gap-6 border-r border-white/10 z-20 shrink-0">
        <div className="mb-2">
          <div className="w-7 h-7 bg-white flex items-center justify-center">
            <Zap size={14} className="text-black" fill="black" />
          </div>
        </div>

        {[
          { v: 'editor' as const, icon: FileCode, label: 'Editor' },
          { v: 'dashboard' as const, icon: BarChart3, label: 'Analytics' },
          { v: 'profile' as const, icon: UserCircle, label: 'Profile' },
        ].map(({ v, icon: Icon, label }) => (
          <button key={v} onClick={() => setView(v)} title={label}
            className={cn("p-2.5 transition-all hover:opacity-100 relative",
              view === v ? "text-white opacity-100" : "text-[#858585] opacity-40")}>
            {view === v && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white" />}
            <Icon size={22} strokeWidth={1.5} />
          </button>
        ))}

        <div className="mt-auto flex flex-col gap-4 pb-4">
          {/* User initials */}
          {profile && (
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-black" title={profile.full_name}>
              {profile.full_name[0].toUpperCase()}
            </div>
          )}
          <button onClick={logout} title="Logout"
            className="p-2 text-[#858585] hover:text-white transition-all opacity-40 hover:opacity-100">
            <LogOut size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div initial={{ width: 0 }} animate={{ width: 280 }} exit={{ width: 0 }}
              className="bg-black border-r border-white/10 overflow-hidden flex flex-col shrink-0">
              <Explorer />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] overflow-hidden">
          {view === 'editor' ? (
            <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
              <div className="flex-1 min-h-0 overflow-hidden">
                <EditorPanel />
              </div>
              {/* Terminal panel */}
              <div className="h-44 border-t border-[#3c3c3c] bg-[#1e1e1e] flex flex-col shrink-0">
                <div className="flex items-center space-x-6 px-4 py-1 border-b border-[#2d2d2d]">
                  {['TERMINAL', 'OUTPUT', 'PROBLEMS', 'DEBUG CONSOLE'].map((tab, i) => (
                    <button key={tab} className={cn("text-[10px] pb-0.5 font-medium tracking-normal",
                      i === 0 ? "text-[#cccccc] border-b border-[#cccccc]" : "text-[#858585] hover:text-[#cccccc]")}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] opacity-80 custom-scrollbar whitespace-pre-wrap">
                  <span className="text-[#858585]">$ </span>npm run dev{"\n"}
                  <span className="text-green-400">  VITE v5.0.0  ready in 847 ms{"\n\n"}</span>
                  <span className="text-blue-400">  ➜  Local:   </span>http://localhost:5173/{"\n"}
                  <span className="text-[#858585]">  ➜  Network: use --host to expose{"\n"}</span>
                  <span className="text-[#858585]">  ➜  Role: {userRole}{"\n"}</span>
                </div>
              </div>
            </div>
          ) : view === 'dashboard' ? <Dashboard /> : <Profile />}
        </div>

        {/* AI Chat */}
        <AnimatePresence initial={false}>
          {isChatOpen && (
            <motion.div initial={{ width: 0 }} animate={{ width: 380 }} exit={{ width: 0 }}
              className="bg-black border-l border-white/10 overflow-hidden flex flex-col shrink-0">
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-black border-t border-white/10 text-[#f5f5f4] flex items-center px-6 text-[9px] uppercase tracking-widest font-bold fixed bottom-0 w-full z-30">
        <span className="opacity-40">TeamForge</span>
        <span className="mx-3 opacity-20">·</span>
        <span>Role: {userRole}</span>
        <div className="ml-auto flex items-center gap-6">
          <span className="opacity-40">Supabase</span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        </div>
      </div>
    </div>
  );
}
