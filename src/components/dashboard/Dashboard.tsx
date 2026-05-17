import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, Users, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/lib/supabaseClient';

function StatCard({ label, value, sub, icon: Icon, accent, amber }: any) {
  return (
    <div
      className="relative group p-6 transition-all duration-200"
      style={{
        background: amber ? 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)' : '#090909',
        border: `1px solid ${amber ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
        borderTop: amber ? '2px solid rgba(245,158,11,0.5)' : undefined,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = amber ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = amber ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'; }}
    >
      <div className="flex items-start justify-between mb-5">
        <div style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', color: amber ? '#f59e0b' : '#5e5855', textTransform: 'uppercase' }}>
          {label}
        </div>
        {Icon && <Icon size={13} style={{ opacity: amber ? 0.5 : 0.18, color: amber ? '#f59e0b' : undefined }} />}
      </div>
      <div
        style={{
          fontFamily: '"Syne", sans-serif',
          fontWeight: 800,
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          marginBottom: 6,
          color: amber ? '#f59e0b' : '#f7f3ee',
        }}
        className={cn(accent || '')}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#3a3836', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CompletedTaskRow({ task, assigneeName, assigneeInitial, assigneeEmail }: {
  task: Task;
  assigneeName: string;
  assigneeInitial: string;
  assigneeEmail: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const downloadPatch = async () => {
    if (!task.patched_zip_path) return;
    setDownloading(true);
    try {
      const { data } = await supabase.storage.from('task-files').createSignedUrl(task.patched_zip_path, 3600);
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = `${task.title.replace(/\s+/g, '-')}-patched.zip`;
        a.click();
      }
    } finally { setDownloading(false); }
  };

  return (
    <div className="px-6 py-5 flex items-start gap-5 group transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.01)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Done check */}
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <CheckCircle size={12} style={{ color: '#4ade80' }} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start gap-3 mb-2">
          <span style={{ fontSize: 13, fontFamily: '"Syne", sans-serif', fontWeight: 700, color: '#f7f3ee', lineHeight: 1.3 }} className="flex-1">
            {task.title}
          </span>
          {task.patched_zip_path && (
            <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 6px', flexShrink: 0 }}>
              zip delivered
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', color: '#5e5855', lineHeight: 1.6, marginBottom: 12 }}
            className="line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Who did it — the important part */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <span style={{ fontSize: 9, color: '#f59e0b', fontFamily: '"Syne", sans-serif', fontWeight: 800 }}>
                {assigneeInitial}
              </span>
            </div>
            <span style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', fontWeight: 600, color: '#f7f3ee' }}>
              {assigneeName}
            </span>
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#3a3836' }}>
              {assigneeEmail}
            </span>
          </div>

          {task.due_date && (
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#3a3836', letterSpacing: '0.08em' }}>
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}

          {task.patched_zip_path && (
            <button
              onClick={downloadPatch}
              disabled={downloading}
              className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 10px' }}
            >
              {downloading ? <Loader2 size={9} className="animate-spin" /> : <Download size={9} />}
              patched.zip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { tasks, users, userRole, currentUserId } = useWorkspace();

  // All tasks the current user can see (RBAC)
  const allVisible = userRole === 'ADMIN' ? tasks : tasks.filter(t => t.assignee_id === currentUserId);

  // Active tasks (non-archived) drive the operational log and live stats
  const activeTasks = allVisible.filter(t => !t.archived);
  // Completed = all DONE regardless of archive state → preserved in history
  const completedTasks = allVisible.filter(t => t.status === 'DONE');

  const now = new Date();
  const done = allVisible.filter(t => t.status === 'DONE');
  const inProgress = activeTasks.filter(t => t.status === 'IN_PROGRESS');
  const todo = activeTasks.filter(t => t.status === 'TODO');
  const overdue = activeTasks.filter(t => t.status !== 'DONE' && t.due_date && new Date(t.due_date) < now);
  const efficiency = allVisible.length > 0 ? Math.round((done.length / allVisible.length) * 100) : 0;

  const pieData = [
    { name: 'Done', value: done.length },
    { name: 'In Progress', value: inProgress.length },
    { name: 'Todo', value: todo.length },
  ];

  const userLoad = useMemo(() => {
    if (userRole !== 'ADMIN') return [];
    return users.map(u => ({
      name: u.full_name.split(' ')[0],
      total: tasks.filter(t => t.assignee_id === u.id).length,
      done: tasks.filter(t => t.assignee_id === u.id && t.status === 'DONE').length,
    })).filter(u => u.total > 0);
  }, [users, tasks, userRole]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] custom-scrollbar pb-12">
      <div className="max-w-6xl mx-auto p-10">

        {/* Header */}
        <div className="flex items-center gap-5 mb-10">
          <div>
            <h1 style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: '#f7f3ee', lineHeight: 1 }}>
              Analytics
            </h1>
            <div style={{ fontSize: 10, color: '#5e5855', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
              {userRole} · Live
            </div>
          </div>
          {overdue.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5"
              style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)', fontFamily: '"Syne", sans-serif' }}>
              <AlertTriangle size={11} />
              {overdue.length} overdue
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Tasks" value={allVisible.length} icon={Clock} amber />
          <StatCard label="Completed" value={done.length} icon={CheckCircle} accent="text-green-400" />
          <StatCard label="In Progress" value={inProgress.length} icon={Clock} accent="text-blue-400" />
          <StatCard label="Efficiency" value={`${efficiency}%`} icon={Users}
            accent={efficiency > 70 ? 'text-green-400' : efficiency > 40 ? 'text-yellow-400' : 'text-red-400'} />
        </div>

        {/* Charts — admin only */}
        {userRole === 'ADMIN' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/5 border border-white/10 mb-8">
            <div className="bg-black p-8">
              <div style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', color: '#5e5855', textTransform: 'uppercase', marginBottom: 24 }}>Throughput Velocity</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                      <Cell fill="#f59e0b" />
                      <Cell fill="#4f8ef7" />
                      <Cell fill="rgba(255,255,255,0.07)" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(245,158,11,0.2)', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', color: '#f7f3ee' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-5 mt-4">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: ['#f59e0b', '#4f8ef7', 'rgba(255,255,255,0.12)'][i] }} />
                    <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5e5855', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d.name} <span style={{ color: '#a09590' }}>{d.value}</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black p-8">
              <div style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', color: '#5e5855', textTransform: 'uppercase', marginBottom: 24 }}>Load Distribution</div>
              <div className="h-56">
                {userLoad.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userLoad} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#5e5855', fontFamily: '"JetBrains Mono", monospace' }} tickFormatter={v => String(v).toUpperCase()} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#5e5855', fontFamily: '"JetBrains Mono", monospace' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(245,158,11,0.2)', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', color: '#f7f3ee' }} />
                      <Bar dataKey="total" name="Total" fill="rgba(245,158,11,0.15)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="done" name="Done" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center" style={{ fontSize: 10, color: '#3a3836', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: '"JetBrains Mono", monospace' }}>No assignment data</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-white/10 bg-black p-8 mb-8">
            <div className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-4">My Progress</div>
            <div className="w-full h-2 bg-white/10 rounded-full">
              <div className="h-2 bg-white rounded-full transition-all" style={{ width: `${efficiency}%` }} />
            </div>
            <div className="text-[9px] opacity-40 mt-2 uppercase">{done.length} of {allVisible.length} tasks complete</div>
          </div>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <div className="border border-red-500/30 bg-red-500/5 p-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Overdue Tasks</span>
            </div>
            <div className="space-y-2">
              {overdue.map(t => {
                const assignee = users.find(u => u.id === t.assignee_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="font-bold">{t.title}</span>
                    {assignee && <span className="text-[9px] opacity-40">{assignee.full_name}</span>}
                    <span className="text-[9px] opacity-40 ml-auto">{t.due_date ? new Date(t.due_date).toLocaleDateString() : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Completed Work — always visible, survives task panel clearing ── */}
        {completedTasks.length > 0 && (
          <div className="mb-8" style={{ border: '1px solid rgba(74,222,128,0.12)', borderTop: '2px solid rgba(74,222,128,0.3)' }}>
            <div className="px-6 py-3 flex items-center justify-between" style={{ background: 'rgba(74,222,128,0.03)', borderBottom: '1px solid rgba(74,222,128,0.08)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle size={12} style={{ color: '#4ade80', opacity: 0.7 }} />
                <h2 style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#4ade80' }}>
                  Completed Work
                </h2>
              </div>
              <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: '#3a3836' }}>
                {completedTasks.length} {completedTasks.length === 1 ? 'task' : 'tasks'} delivered
              </span>
            </div>

            {completedTasks.map(task => {
              const assignee = users.find(u => u.id === task.assignee_id);
              if (!assignee) return (
                <div key={task.id} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, fontFamily: '"Syne", sans-serif', fontWeight: 700, color: '#f7f3ee' }}>{task.title}</span>
                  <span style={{ fontSize: 9, color: '#3a3836', marginLeft: 12, fontFamily: '"JetBrains Mono", monospace' }}>unassigned</span>
                </div>
              );
              return (
                <CompletedTaskRow
                  key={task.id}
                  task={task}
                  assigneeName={assignee.full_name}
                  assigneeInitial={assignee.full_name[0]}
                  assigneeEmail={assignee.email}
                />
              );
            })}
          </div>
        )}

        {/* Operational Log — active tasks only (cleared tasks excluded) */}
        <div className="bg-black border border-white/10">
          <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-[9px] font-black uppercase tracking-[0.25em]">Operational Log</h2>
            <span className="text-[8px] opacity-30">{activeTasks.length} active</span>
          </div>
          <div className="divide-y divide-white/5">
            {activeTasks.map((task, i) => {
              const assignee = task.assignee_id ? users.find(u => u.id === task.assignee_id) : null;
              const isOverdue = task.status !== 'DONE' && task.due_date && new Date(task.due_date) < now;
              return (
                <div key={task.id}
                  className="flex px-6 py-3 items-center gap-8 group hover:bg-white/[0.02] transition-colors">
                  <span className="text-[9px] font-black opacity-20 tabular-nums">{String(i + 1).padStart(3, '0')}</span>
                  <span className="flex-1 text-[11px] font-bold uppercase tracking-wide truncate">{task.title}</span>
                  {assignee && (
                    <span className="text-[9px] hidden sm:block truncate max-w-[110px]"
                      style={{ color: '#a09590', fontFamily: '"DM Sans", sans-serif' }}>
                      {assignee.full_name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className={cn('text-[9px] tabular-nums hidden lg:block', isOverdue ? 'text-red-400' : 'opacity-30')}>
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className={cn('text-[8px] font-black uppercase tracking-widest px-2 py-1 border shrink-0',
                    task.status === 'DONE' ? 'bg-white text-black border-white' :
                    task.status === 'IN_PROGRESS' ? 'text-blue-400 border-blue-400/30' : 'text-white/30 border-white/10')}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
            {activeTasks.length === 0 && (
              <div className="p-10 text-center text-[10px] opacity-20 uppercase tracking-widest">All tasks cleared.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
