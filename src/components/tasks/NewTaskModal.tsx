import React, { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function NewTaskModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { users, projects, loginState, currentUserId, setTasks, refetchTasks } = useWorkspace();
  const emptyForm = { title: '', description: '', assignee_id: '', priority: 'MED' as 'LOW' | 'MED' | 'HIGH', due_date: new Date().toISOString().split('T')[0] };
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);

    if (loginState === 'guest') {
      setTasks(prev => [...prev, { id: Math.random().toString(36).slice(2), title: form.title, description: form.description, assignee_id: form.assignee_id || null, status: 'TODO', priority: form.priority, project_id: 'demo', due_date: form.due_date }]);
      onClose(); setLoading(false); return;
    }

    try {
      const { error } = await supabase.from('tasks').insert({
        title: form.title, description: form.description || null,
        assignee_id: form.assignee_id || null, status: 'TODO',
        priority: form.priority,
        project_id: projects[0]?.id,
        due_date: form.due_date || null,
        creator_id: currentUserId,
      });
      if (error) throw error;
      await refetchTasks();
      onClose();
      setForm(emptyForm);
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[480px] bg-[#0a0a0a] border border-white/10">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">Create Task</h2>
          <button onClick={onClose}><X size={18} className="opacity-40 hover:opacity-100" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <input placeholder="TASK TITLE" value={form.title} required
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="bg-black border border-white/20 p-3 text-xs outline-none focus:border-white uppercase text-white" />
          <textarea placeholder="Description..." value={form.description} rows={3}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="bg-black border border-white/20 p-3 text-xs outline-none focus:border-white resize-none text-white/80 custom-scrollbar" />
          <div className="flex gap-3">
            <select value={form.assignee_id} onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}
              className="flex-1 bg-black border border-white/20 p-3 text-xs outline-none text-white uppercase">
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'LOW' | 'MED' | 'HIGH' }))}
              className="bg-black border border-white/20 p-3 text-xs outline-none text-white uppercase w-28">
              <option value="LOW">Low</option>
              <option value="MED">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            className="bg-black border border-white/20 p-3 text-xs outline-none text-white" />
          <button type="submit" disabled={loading}
            className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-4 hover:bg-white/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
