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
    width: '100%', background: 'transparent', outline: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '9px 0',
    fontSize: 12, fontFamily: '"DM Sans", sans-serif', color: '#f7f3ee', transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700,
    letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3a3836',
    display: 'block', marginBottom: 6,
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderBottomColor = '#f59e0b');
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderBottomColor = 'rgba(255,255,255,0.08)');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(3,3,3,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-[500px]" style={{ background: '#080808', border: '1px solid rgba(255,255,255,0.07)', borderTop: '2px solid #f59e0b', boxShadow: '0 32px 64px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div className="flex justify-between items-center px-7 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f7f3ee' }}>New Task</span>
          <button onClick={onClose} style={{ color: '#3a3836', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f7f3ee')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-5">
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input placeholder="What needs to be done?" value={form.title} required
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={{ ...fieldStyle, fontSize: 13, fontFamily: '"Syne", sans-serif', fontWeight: 600 }}
              onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea placeholder="Additional context…" value={form.description} rows={2}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full outline-none resize-none custom-scrollbar transition-all"
              style={{ ...fieldStyle }}
              onFocus={handleFocus as any} onBlur={handleBlur as any} />
          </div>

          {/* URL */}
          <div>
            <label style={labelStyle}>Reference URL</label>
            <div className="relative flex items-center">
              <Link size={11} className="absolute left-0" style={{ color: '#3a3836' }} />
              <input placeholder="https://…" value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                style={{ ...fieldStyle, paddingLeft: 20 }}
                onFocus={handleFocus} onBlur={handleBlur} />
            </div>
          </div>

          {/* ZIP upload */}
          <div>
            <label style={labelStyle}>Codebase ZIP</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 cursor-pointer transition-all p-3"
              style={{ border: `1px dashed ${zipFile ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`, background: zipFile ? 'rgba(245,158,11,0.04)' : 'transparent' }}
              onMouseEnter={e => { if (!zipFile) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { if (!zipFile) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              {zipFile ? (
                <>
                  <File size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span className="truncate flex-1" style={{ fontSize: 11, color: '#a09590', fontFamily: '"JetBrains Mono", monospace' }}>{zipFile.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setZipFile(null); }} style={{ color: '#3a3836' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}>
                    <X size={11} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={12} style={{ color: '#3a3836', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3a3836' }}>Upload .zip</span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip" className="hidden"
              onChange={e => setZipFile(e.target.files?.[0] ?? null)} />
          </div>

          {/* Assignee + Priority */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label style={labelStyle}>Assignee</label>
              <select value={form.assignee_id} onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}
                style={{ ...fieldStyle, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#a09590' }}
                onFocus={handleFocus as any} onBlur={handleBlur as any}>
                <option value="" style={{ background: '#080808' }}>Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id} style={{ background: '#080808' }}>{u.full_name}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                style={{ ...fieldStyle, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#a09590' }}
                onFocus={handleFocus as any} onBlur={handleBlur as any}>
                <option value="LOW" style={{ background: '#080808' }}>Low</option>
                <option value="MED" style={{ background: '#080808' }}>Medium</option>
                <option value="HIGH" style={{ background: '#080808' }}>High</option>
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
              style={{ ...fieldStyle, colorScheme: 'dark' }}
              onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 flex items-center justify-center gap-2 transition-all mt-1"
            style={{ background: '#f59e0b', color: '#000', fontSize: 10, fontFamily: '"Syne", sans-serif', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <><Loader2 size={12} className="animate-spin" /><span>{uploadProgress || 'Creating…'}</span></>
            ) : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
