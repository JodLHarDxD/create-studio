import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, Users, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { Task } from '@/lib/supabaseClient';

function StatCard({ label, value, sub, icon: Icon, accent, highlight }: any) {
  return (
    <div
      className="relative group p-6 transition-all duration-300 border backdrop-blur-md"
      style={{
        background: highlight ? 'rgba(52,211,153,0.04)' : 'rgba(24,24,27,0.4)',
        borderColor: highlight ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.25em',
            color: highlight ? '#34d399' : '#71717a',
          }}
        >
          {label}
        </div>
        {Icon && <Icon size={14} className={highlight ? 'text-emerald-400' : 'text-zinc-600'} strokeWidth={1.5} />}
      </div>
      <div
        className={cn('mb-2', accent || '')}
        style={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 400,
          fontSize: 56,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: highlight ? '#34d399' : '#f4f4f5',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-zinc-500 tracking-[0.20em] uppercase font-mono">
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
    <div className="px-6 py-5 flex items-start gap-5 group transition-colors hover:bg-white/[0.02] border-b border-white/[0.04]">
      <div className="w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 bg-emerald-500/[0.06] border border-emerald-400/30">
        <CheckCircle size={12} className="text-emerald-400" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-2">
          <span
            className="flex-1 font-display text-zinc-100"
            style={{ fontSize: 16, fontStyle: 'italic', fontWeight: 400, lineHeight: 1.3 }}
          >
            {task.title}
          </span>
          {task.patched_zip_path && (
            <span className="text-[8px] font-mono tracking-[0.25em] uppercase text-emerald-300 border border-emerald-400/30 px-2 py-0.5 flex-shrink-0">
              zip delivered
            </span>
          )}
        </div>

        {task.description && (
          <p className="line-clamp-2 text-[12px] text-zinc-400 leading-relaxed mb-3">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/[0.06] border border-emerald-400/20">
            <div className="w-5 h-5 overflow-hidden flex items-center justify-center shrink-0 bg-emerald-500/[0.15] border border-emerald-400/40">
              {assigneeAvatar
                ? <img src={assigneeAvatar} alt={assigneeName} className="w-full h-full object-cover" />
                : <span className="text-[9px] text-emerald-300 font-display italic">{assigneeInitial}</span>}
            </div>
            <span className="text-[11px] font-medium text-zinc-100">{assigneeName}</span>
            <span className="text-[9px] font-mono text-zinc-500 tracking-wide">{assigneeEmail}</span>
          </div>

          {task.due_date && (
            <span className="text-[9px] font-mono text-zinc-500 tracking-[0.10em]">
              {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}

          {task.patched_zip_path && (
            <button
              onClick={downloadPatch}
              disabled={downloading}
              className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-mono tracking-[0.20em] uppercase text-emerald-300 border border-emerald-400/40 px-3 py-1 hover:bg-emerald-500/10"
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

  const allVisible = userRole === 'ADMIN' ? tasks : tasks.filter(t => t.assignee_id === currentUserId);
  const activeTasks = allVisible.filter(t => !t.archived);
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
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-12 bg-zinc-950/40">
      <div className="max-w-6xl mx-auto p-10">

        {/* Header */}
        <div className="flex items-end gap-5 mb-12 pb-8 border-b border-white/[0.06]">
          <div>
            <div className="text-emerald-400 font-mono text-[10px] tracking-[0.25em] uppercase mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {userRole} · Live Telemetry
            </div>
            <h1
              className="font-display italic text-zinc-100"
              style={{ fontWeight: 400, fontSize: 64, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              Analytics.
            </h1>
          </div>
          {overdue.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] px-3 py-2 text-red-300 border border-red-400/30 bg-red-500/[0.06]">
              <AlertTriangle size={11} strokeWidth={1.5} />
              {overdue.length} overdue
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          <StatCard label="Total Tasks" value={allVisible.length} icon={Clock} highlight />
          <StatCard label="Completed" value={done.length} icon={CheckCircle} />
          <StatCard label="In Progress" value={inProgress.length} icon={Clock} />
          <StatCard
            label="Efficiency"
            value={`${efficiency}%`}
            icon={Users}
            accent={efficiency > 70 ? 'text-emerald-400' : efficiency > 40 ? 'text-amber-300' : 'text-red-400'}
          />
        </div>

        {/* Charts — admin only */}
        {userRole === 'ADMIN' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-10">
            <div className="p-7 bg-zinc-900/40 border border-white/[0.06] backdrop-blur-md">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-6">Throughput</div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={4} dataKey="value" stroke="none">
                      <Cell fill="#34d399" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="rgba(255,255,255,0.08)" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 0, fontSize: '11px', fontFamily: '"Inter", sans-serif', color: '#f4f4f5' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-5 mt-3">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: ['#34d399', '#8b5cf6', 'rgba(255,255,255,0.18)'][i] }} />
                    <span className="text-[10px] text-zinc-400">
                      {d.name} <span className="text-zinc-100 font-semibold">{d.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-7 bg-zinc-900/40 border border-white/[0.06] backdrop-blur-md">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-6">Load Distribution</div>
              <div className="h-52">
                {userLoad.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userLoad} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontFamily: '"Inter", sans-serif' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#71717a', fontFamily: '"Inter", sans-serif' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 0, fontSize: '11px', fontFamily: '"Inter", sans-serif', color: '#f4f4f5' }} />
                      <Bar dataKey="total" name="Total" fill="rgba(139,92,246,0.30)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="done" name="Done" fill="#34d399" radius={[0, 0, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[11px] text-zinc-600 font-display italic">No assignment data</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-white/[0.06] bg-zinc-900/40 backdrop-blur-md p-8 mb-10">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-4">My Progress</div>
            <div className="w-full h-1 bg-white/[0.06] overflow-hidden">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${efficiency}%`,
                  background: 'linear-gradient(90deg, #34d399, #8b5cf6)',
                  boxShadow: '0 0 8px rgba(52,211,153,0.6)',
                }}
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-3 tracking-[0.15em] uppercase">
              {done.length} of {allVisible.length} tasks complete · <span className="text-emerald-400">{efficiency}%</span>
            </div>
          </div>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <div className="border border-red-400/30 bg-red-500/[0.04] p-6 mb-10 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-red-400" strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-red-300">Overdue Tasks</span>
            </div>
            <div className="space-y-2">
              {overdue.map(t => {
                const assignee = users.find(u => u.id === t.assignee_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 text-[12px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <span className="font-medium text-zinc-100">{t.title}</span>
                    {assignee && <span className="text-[10px] text-zinc-500 font-mono">{assignee.full_name}</span>}
                    <span className="text-[10px] text-red-400 font-mono ml-auto">{t.due_date ? new Date(t.due_date).toLocaleDateString() : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Work */}
        {completedTasks.length > 0 && (
          <div className="mb-10 border border-emerald-400/20 bg-emerald-500/[0.02] backdrop-blur-md">
            <div className="px-6 py-3.5 flex items-center justify-between bg-emerald-500/[0.04] border-b border-emerald-400/10">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-emerald-400" strokeWidth={1.5} />
                <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald-400">
                  Completed Work
                </h2>
              </div>
              <span className="text-[9px] font-mono text-zinc-500 tracking-[0.15em] uppercase">
                {completedTasks.length} {completedTasks.length === 1 ? 'task' : 'tasks'} delivered
              </span>
            </div>

            {completedTasks.map(task => {
              const assignee = users.find(u => u.id === task.assignee_id);
              if (!assignee) return (
                <div key={task.id} className="px-6 py-4 border-b border-white/[0.04]">
                  <span className="font-display italic text-[15px] text-zinc-100">{task.title}</span>
                  <span className="text-[10px] text-zinc-600 ml-3 font-mono">unassigned</span>
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

        {/* Operational Log */}
        <div className="bg-zinc-900/40 border border-white/[0.06] backdrop-blur-md">
          <div className="px-6 py-3.5 border-b border-white/[0.06] flex justify-between items-center">
            <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500">Operational Log</h2>
            <span className="text-[9px] font-mono text-zinc-600 tracking-[0.15em]">{activeTasks.length} active</span>
          </div>
          <div>
            {activeTasks.map((task, i) => {
              const assignee = task.assignee_id ? users.find(u => u.id === task.assignee_id) : null;
              const isOverdue = task.status !== 'DONE' && task.due_date && new Date(task.due_date) < now;
              return (
                <div
                  key={task.id}
                  className="flex px-6 py-3 items-center gap-8 group hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]"
                >
                  <span className="font-mono text-[10px] text-zinc-600 tabular-nums tracking-[0.10em]">
                    {String(i + 1).padStart(3, '0')}
                  </span>
                  <span className="flex-1 text-[12px] text-zinc-200 truncate">{task.title}</span>
                  {assignee && (
                    <span className="text-[10px] hidden sm:block truncate max-w-[110px] text-zinc-500">
                      {assignee.full_name}
                    </span>
                  )}
                  {task.due_date && (
                    <span
                      className={cn(
                        'text-[10px] font-mono tabular-nums hidden lg:block tracking-[0.10em]',
                        isOverdue ? 'text-red-400' : 'text-zinc-600',
                      )}
                    >
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-[8px] font-mono uppercase tracking-[0.25em] px-2 py-1 border shrink-0',
                      task.status === 'DONE'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40'
                        : task.status === 'IN_PROGRESS'
                          ? 'text-violet-300 border-violet-400/40 bg-violet-500/[0.06]'
                          : 'text-zinc-500 border-white/10',
                    )}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
            {activeTasks.length === 0 && (
              <div className="p-10 text-center text-[12px] text-zinc-600 font-display italic tracking-wide">
                All tasks cleared.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
