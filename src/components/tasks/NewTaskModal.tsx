import React, { useState, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { X, Loader2, Link, Upload, File } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function NewTaskModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { users, projects, loginState, currentUserId, setTasks, refetchTasks } = useWorkspace();
  const emptyForm = {
    title: '', description: '', assignee_id: '',
    priority: 'MED' as 'LOW' | 'MED' | 'HIGH',
    due_date: new Date().toISOString().split('T')[0],
    url: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);

    if (loginState === 'guest') {
      setTasks(prev => [...prev, {
        id: Math.random().toString(36).slice(2), title: form.title,
        description: form.description, assignee_id: form.assignee_id || null,
        status: 'TODO', priority: form.priority, project_id: 'demo',
        due_date: form.due_date, url: form.url || null,
      }]);
      onClose(); setLoading(false); return;
    }

    try {
      setUploadProgress('Creating task…');
      const { data: task, error } = await supabase.from('tasks').insert({
        title: form.title, description: form.description || null,
        assignee_id: form.assignee_id || null, status: 'TODO',
        priority: form.priority, project_id: projects[0]?.id,
        due_date: form.due_date || null, creator_id: currentUserId,
        url: form.url || null,
      }).select().single();
      if (error) throw error;

      if (zipFile && task) {
        setUploadProgress('Uploading codebase ZIP…');
        const path = `tasks/${task.id}/original.zip`;
        const { error: upErr } = await supabase.storage.from('task-files').upload(path, zipFile, { upsert: true });
        if (upErr) throw upErr;
        await supabase.from('tasks').update({ original_zip_path: path }).eq('id', task.id);
      }

      await refetchTasks();
      onClose();
      setForm(emptyForm);
      setZipFile(null);
      setUploadProgress('');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setLoading(false); setUploadProgress(''); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(9,9,11,0.72)', backdropFilter: 'blur(12px) saturate(1.2)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[520px] border border-white/[0.10] bg-zinc-950/95 backdrop-blur-2xl shadow-deep"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-7 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 amber-pulse" />
            <div>
              <div className="font-display italic text-zinc-100 text-[20px]">New task.</div>
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500 mt-0.5">
                Initialize node
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center transition-all text-zinc-500 hover:text-red-400 hover:bg-white/[0.04]"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className="form-label">Title *</label>
            <input
              placeholder="What needs to be done?"
              value={form.title}
              required
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="input-contained"
              style={{ fontSize: 15, fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontWeight: 400 }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              placeholder="Additional context…"
              value={form.description}
              rows={2}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="input-contained custom-scrollbar resize-none"
            />
          </div>

          {/* URL */}
          <div>
            <label className="form-label">Reference URL</label>
            <div className="relative flex items-center">
              <Link size={12} className="absolute left-3 text-zinc-500" />
              <input
                placeholder="https://…"
                value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                className="input-contained"
                style={{ paddingLeft: 32 }}
              />
            </div>
          </div>

          {/* ZIP upload */}
          <div>
            <label className="form-label">Codebase ZIP</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 cursor-pointer transition-all px-3.5 py-3"
              style={{
                border: `1px dashed ${zipFile ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.10)'}`,
                background: zipFile ? 'rgba(52,211,153,0.04)' : 'rgba(24,24,27,0.40)',
              }}
            >
              {zipFile ? (
                <>
                  <File size={13} className="text-emerald-400 flex-shrink-0" strokeWidth={1.5} />
                  <span className="truncate flex-1 text-[12px] text-emerald-300 font-mono">{zipFile.name}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setZipFile(null); }}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={13} className="text-zinc-500 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-[11px] text-zinc-500 font-mono tracking-wide">Upload .zip file</span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => setZipFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Assignee + Priority */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="form-label">Assignee</label>
              <select
                value={form.assignee_id}
                onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}
                className="input-contained cursor-pointer"
              >
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <label className="form-label">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                className="input-contained cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MED">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="form-label">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              className="input-contained"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 flex items-center justify-center gap-2 transition-all mt-2 font-mono text-[10px] tracking-[0.25em] uppercase font-semibold border"
            style={{
              background: loading ? 'rgba(52,211,153,0.20)' : '#34d399',
              color: '#09090b',
              borderColor: '#34d399',
              opacity: loading ? 0.7 : 1,
              boxShadow: loading ? 'none' : '0 8px 24px rgba(52,211,153,0.25)',
            }}
          >
            {loading ? (
              <><Loader2 size={12} className="animate-spin" /><span>{uploadProgress || 'Creating…'}</span></>
            ) : 'Initialize Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
