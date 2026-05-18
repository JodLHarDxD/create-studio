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

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 2,
    outline: 'none',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: '"DM Sans", sans-serif',
    color: '#f7f3ee',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(245,158,11,0.45)';
    e.target.style.background = 'rgba(255,255,255,0.06)';
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.09)';
    e.target.style.background = 'rgba(255,255,255,0.04)';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(3,3,3,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-[500px]" style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.07)', borderTop: '2px solid #f59e0b', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div className="flex justify-between items-center px-7 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#f7f3ee' }}>New Task</div>
          </div>
          <button onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 flex items-center justify-center rounded transition-all"
            style={{ color: '#5e5855', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f7f3ee'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5e5855'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          {/* Title */}
          <div>
            <label className="form-label">Title *</label>
            <input placeholder="What needs to be done?" value={form.title} required
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={{ ...fieldStyle, fontSize: 14, fontFamily: '"Syne", sans-serif', fontWeight: 600 }}
              onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea placeholder="Additional context…" value={form.description} rows={2}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full outline-none resize-none custom-scrollbar transition-all"
              style={{ ...fieldStyle }}
              onFocus={handleFocus as any} onBlur={handleBlur as any} />
          </div>

          {/* URL */}
          <div>
            <label className="form-label">Reference URL</label>
            <div className="relative flex items-center">
              <Link size={12} className="absolute" style={{ color: '#3a3836', left: 12 }} />
              <input placeholder="https://…" value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                style={{ ...fieldStyle, paddingLeft: 34 }}
                onFocus={handleFocus} onBlur={handleBlur} />
            </div>
          </div>

          {/* ZIP upload */}
          <div>
            <label className="form-label">Codebase ZIP</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 cursor-pointer transition-all"
              style={{ padding: '11px 14px', border: `1px dashed ${zipFile ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.09)'}`, background: zipFile ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: 2 }}
              onMouseEnter={e => { if (!zipFile) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { if (!zipFile) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'; }}
            >
              {zipFile ? (
                <>
                  <File size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span className="truncate flex-1" style={{ fontSize: 12, color: '#a09590', fontFamily: '"JetBrains Mono", monospace' }}>{zipFile.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setZipFile(null); }} style={{ color: '#3a3836', transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}>
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={13} style={{ color: '#3a3836', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', color: '#3a3836' }}>Upload .zip file</span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip" className="hidden"
              onChange={e => setZipFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Assignee + Priority */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="form-label">Assignee</label>
              <select value={form.assignee_id} onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}
                style={{ ...fieldStyle }}
                onFocus={handleFocus as any} onBlur={handleBlur as any}>
                <option value="" style={{ background: '#0e0e0e' }}>Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id} style={{ background: '#0e0e0e' }}>{u.full_name}</option>)}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <label className="form-label">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                style={{ ...fieldStyle }}
                onFocus={handleFocus as any} onBlur={handleBlur as any}>
                <option value="LOW" style={{ background: '#0e0e0e' }}>Low</option>
                <option value="MED" style={{ background: '#0e0e0e' }}>Medium</option>
                <option value="HIGH" style={{ background: '#0e0e0e' }}>High</option>
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="form-label">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              style={{ ...fieldStyle, colorScheme: 'dark' }}
              onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 flex items-center justify-center gap-2 transition-all mt-1"
            style={{ background: '#f59e0b', color: '#000', fontSize: 11, fontFamily: '"Syne", sans-serif', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: loading ? 0.7 : 1, borderRadius: 2, boxShadow: loading ? 'none' : '0 4px 16px rgba(245,158,11,0.2)' }}>
            {loading ? (
              <><Loader2 size={12} className="animate-spin" /><span>{uploadProgress || 'Creating…'}</span></>
            ) : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
