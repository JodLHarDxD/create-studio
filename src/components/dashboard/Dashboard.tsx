import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, accent }: any) {
  return (
    <div className="bg-black border border-white/10 p-6 relative group hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40">{label}</div>
        {Icon && <Icon size={14} className="opacity-20" />}
      </div>
      <div className={cn("text-4xl font-black italic tracking-tighter mb-1", accent || "")}>{value}</div>
      {sub && <div className="text-[9px] opacity-30 uppercase tracking-widest">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { tasks, users, userRole, currentUserId, setView } = useWorkspace();

  // RBAC: admin sees all, member sees own
  const visibleTasks = userRole === 'ADMIN' ? tasks : tasks.filter(t => t.assignee_id === currentUserId);

  const now = new Date();
  const done = visibleTasks.filter(t => t.status === 'DONE');
  const inProgress = visibleTasks.filter(t => t.status === 'IN_PROGRESS');
  const todo = visibleTasks.filter(t => t.status === 'TODO');
  const overdue = visibleTasks.filter(t => t.status !== 'DONE' && t.due_date && new Date(t.due_date) < now);
  const efficiency = visibleTasks.length > 0 ? Math.round((done.length / visibleTasks.length) * 100) : 0;

  const pieData = [
    { name: 'Done', value: done.length },
    { name: 'In Progress', value: inProgress.length },
    { name: 'Todo', value: todo.length },
  ];

  // Per-user load (admin only)
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
        <div className="flex items-center gap-4 mb-10">
          <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-[0.25em]">Live Analytics</span>
          <span className="text-[9px] uppercase tracking-widest opacity-30 font-bold">Role: {userRole}</span>
          {overdue.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest">
              <AlertTriangle size={13} />
              {overdue.length} overdue
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/10 mb-8">
          <StatCard label="Total Tasks" value={visibleTasks.length} icon={Clock} />
          <StatCard label="Completed" value={done.length} accent="text-green-400" icon={CheckCircle} />
          <StatCard label="In Progress" value={inProgress.length} accent="text-blue-400" icon={Clock} />
          <StatCard label="Efficiency" value={`${efficiency}%`} icon={Users} accent={efficiency > 70 ? 'text-green-400' : efficiency > 40 ? 'text-yellow-400' : 'text-red-400'} />
        </div>

        {/* Charts — admin only */}
        {userRole === 'ADMIN' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/5 border border-white/10 mb-8">
            {/* Pie */}
            <div className="bg-black p-8">
              <div className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-6">Throughput Velocity</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                      <Cell fill="#ffffff" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="rgba(255,255,255,0.1)" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.15)', fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-4">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: ['#fff', '#3b82f6', 'rgba(255,255,255,0.15)'][i] }} />
                    <span className="text-[9px] uppercase opacity-50">{d.name} {d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar - user load */}
            <div className="bg-black p-8">
              <div className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-6">Load Distribution</div>
              <div className="h-56">
                {userLoad.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userLoad} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666', textTransform: 'uppercase' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.15)', fontSize: '10px' }} />
                      <Bar dataKey="total" name="Total" fill="rgba(255,255,255,0.15)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="done" name="Done" fill="white" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] opacity-20 uppercase">No assignment data</div>
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
            <div className="text-[9px] opacity-40 mt-2 uppercase">{done.length} of {myTasks(currentUserId, tasks)} tasks complete</div>
          </div>
        )}

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="border border-red-500/30 bg-red-500/5 p-6 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Overdue Tasks</span>
            </div>
            <div className="space-y-2">
              {overdue.map(t => (
                <div key={t.id} className="flex items-center gap-3 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="font-bold">{t.title}</span>
                  <span className="text-[9px] opacity-40 ml-auto">{t.due_date ? new Date(t.due_date).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task log */}
        <div className="bg-black border border-white/10">
          <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-[9px] font-black uppercase tracking-[0.25em]">Operational Log</h2>
            <span className="text-[8px] opacity-30">{visibleTasks.length} tasks</span>
          </div>
          <div className="divide-y divide-white/5">
            {visibleTasks.map((task, i) => {
              const assignee = task.assignee_id ? users.find(u => u.id === task.assignee_id) : null;
              const isOverdue = task.status !== 'DONE' && task.due_date && new Date(task.due_date) < now;
              return (
                <div key={task.id} onClick={() => setView('editor')}
                  className="flex px-6 py-3 items-center gap-8 group hover:bg-white/3 transition-colors cursor-pointer">
                  <span className="text-[9px] font-black opacity-20 tabular-nums">{String(i + 1).padStart(3, '0')}</span>
                  <span className="flex-1 text-[11px] font-bold uppercase tracking-wide truncate">{task.title}</span>
                  {assignee && <span className="text-[9px] opacity-30 hidden sm:block truncate max-w-[100px]">{assignee.full_name}</span>}
                  {task.due_date && (
                    <span className={cn("text-[9px] tabular-nums hidden lg:block", isOverdue ? "text-red-400" : "opacity-30")}>
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                  <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-1 border shrink-0",
                    task.status === 'DONE' ? "bg-white text-black border-white" :
                    task.status === 'IN_PROGRESS' ? "text-blue-400 border-blue-400/30" : "text-white/30 border-white/10")}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
            {visibleTasks.length === 0 && (
              <div className="p-10 text-center text-[10px] opacity-20 uppercase tracking-widest">No tasks assigned.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function myTasks(currentUserId: string | null, tasks: any[]) {
  return tasks.filter(t => t.assignee_id === currentUserId).length;
}
