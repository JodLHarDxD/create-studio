import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, Users, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/lib/supabaseClient';

function StatCard({ label, value, sub, icon: Icon, accent, highlight }: any) {
  return (
    <div
      className="relative group p-6 transition-all duration-200"
      style={{
        background: highlight ? 'rgba(94,106,210,0.07)' : '#0D0D13',
        border: `1px solid ${highlight ? 'rgba(94,106,210,0.2)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 4,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = highlight ? 'rgba(94,106,210,0.35)' : 'rgba(255,255,255,0.13)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = highlight ? 'rgba(94,106,210,0.2)' : 'rgba(255,255,255,0.07)'; }}
    >
      <div className="flex items-start justify-between mb-4">
        <div style={{ fontSize: 10, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: highlight ? '#5E6AD2' : '#505068', textTransform: 'uppercase' }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ opacity: highlight ? 0.6 : 0.2, color: highlight ? '#5E6AD2' : '#8A8AA0' }} />}
      </div>
      <div
        style={{
          fontFamily: '"Syne", sans-serif',
          fontWeight: 800,
          fontSize: 44,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          marginBottom: 8,
          color: highlight ? '#5E6AD2' : '#EBEBF0',
          fontVariantNumeric: 'tabular-nums',
        }}
        className={cn(accent || '')}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#505068', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CompletedTaskRow({ task, assigneeName, assigneeInitial, assigneeEmail, assigneeAvatar }: {
  task: Task;
  assigneeName: string;
  assigneeInitial: string;
  assigneeEmail: string;
  assigneeAvatar?: string | null;
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
          <span style={{ fontSize: 13, fontFamily: '"Syne", sans-serif', fontWeight: 700, color: '#EBEBF0', lineHeight: 1.3 }} className="flex-1">
            {task.title}
          </span>
          {task.patched_zip_path && (
            <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5E6AD2', border: '1px solid rgba(94,106,210,0.2)', padding: '2px 6px', flexShrink: 0 }}>
              zip delivered
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', color: '#505068', lineHeight: 1.6, marginBottom: 12 }}
            className="line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Who did it — the important part */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1"
            style={{ background: 'rgba(94,106,210,0.06)', border: '1px solid rgba(94,106,210,0.15)' }}>
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'rgba(94,106,210,0.15)', border: '1px solid rgba(94,106,210,0.3)' }}>
              {assigneeAvatar
                ? <img src={assigneeAvatar} alt={assigneeName} className="w-full h-full object-cover" />
                : <span style={{ fontSize: 9, color: '#5E6AD2', fontFamily: '"Syne", sans-serif', fontWeight: 800 }}>{assigneeInitial}</span>}
            </div>
            <span style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', fontWeight: 600, color: '#EBEBF0' }}>
              {assigneeName}
            </span>
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#2E2E40' }}>
              {assigneeEmail}
            </span>
          </div>

          {task.due_date && (
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#2E2E40', letterSpacing: '0.08em' }}>
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}

          {task.patched_zip_path && (
            <button
              onClick={downloadPatch}
              disabled={downloading}
              className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#5E6AD2', border: '1px solid rgba(94,106,210,0.25)', padding: '3px 10px' }}
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
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-12" style={{ background: '#09090E' }}>
      <div className="max-w-6xl mx-auto p-10">

        {/* Header */}
        <div className="flex items-center gap-5 mb-10">
          <div>
            <h1 style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: '#EBEBF0', lineHeight: 1 }}>
              Analytics
            </h1>
            <div style={{ fontSize: 10, color: '#505068', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
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
          <StatCard label="Total Tasks" value={allVisible.length} icon={Clock} highlight />
          <StatCard label="Completed" value={done.length} icon={CheckCircle} accent="text-green-400" />
          <StatCard label="In Progress" value={inProgress.length} icon={Clock} accent="text-blue-400" />
          <StatCard label="Efficiency" value={`${efficiency}%`} icon={Users}
            accent={efficiency > 70 ? 'text-green-400' : efficiency > 40 ? 'text-yellow-400' : 'text-red-400'} />
        </div>

        {/* Charts — admin only */}
        {userRole === 'ADMIN' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
            <div className="p-7" style={{ background: '#0D0D13', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4 }}>
              <div style={{ fontSize: 10, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#505068', textTransform: 'uppercase', marginBottom: 24 }}>Throughput</div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={4} dataKey="value" stroke="none">
                      <Cell fill="#4ade80" />
                      <Cell fill="#5E6AD2" />
                      <Cell fill="rgba(255,255,255,0.06)" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: '11px', fontFamily: '"DM Sans", sans-serif', color: '#EBEBF0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-5 mt-3">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ['#4ade80', '#5E6AD2', 'rgba(255,255,255,0.15)'][i] }} />
                    <span style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', color: '#505068' }}>{d.name} <span style={{ color: '#8A8AA0', fontWeight: 600 }}>{d.value}</span></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-7" style={{ background: '#0D0D13', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4 }}>
              <div style={{ fontSize: 10, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#505068', textTransform: 'uppercase', marginBottom: 24 }}>Load Distribution</div>
              <div className="h-52">
                {userLoad.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userLoad} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#505068', fontFamily: '"DM Sans", sans-serif' }} tickFormatter={v => String(v)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#505068', fontFamily: '"DM Sans", sans-serif' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: '11px', fontFamily: '"DM Sans", sans-serif', color: '#EBEBF0' }} />
                      <Bar dataKey="total" name="Total" fill="rgba(94,106,210,0.18)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="done" name="Done" fill="#5E6AD2" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center" style={{ fontSize: 11, color: '#2E2E42', fontFamily: '"DM Sans", sans-serif' }}>No assignment data</div>
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
              <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', color: '#2E2E40' }}>
                {completedTasks.length} {completedTasks.length === 1 ? 'task' : 'tasks'} delivered
              </span>
            </div>

            {completedTasks.map(task => {
              const assignee = users.find(u => u.id === task.assignee_id);
              if (!assignee) return (
                <div key={task.id} className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12, fontFamily: '"Syne", sans-serif', fontWeight: 700, color: '#EBEBF0' }}>{task.title}</span>
                  <span style={{ fontSize: 9, color: '#2E2E40', marginLeft: 12, fontFamily: '"JetBrains Mono", monospace' }}>unassigned</span>
                </div>
              );
              return (
                <CompletedTaskRow
                  key={task.id}
                  task={task}
                  assigneeName={assignee.full_name}
                  assigneeInitial={assignee.full_name[0]}
                  assigneeEmail={assignee.email}
                  assigneeAvatar={assignee.avatar_url}
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
                      style={{ color: '#8A8AA0', fontFamily: '"DM Sans", sans-serif' }}>
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
