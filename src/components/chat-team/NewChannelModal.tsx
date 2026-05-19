import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Props { isOpen: boolean; onClose: () => void; onCreated: () => void; }

export default function NewChannelModal({ isOpen, onClose, onCreated }: Props) {
  const { activeProject, currentUserId } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!activeProject || !currentUserId) return;
    const clean = name.trim().toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 32);
    if (!clean) { setErr('Name must contain at least one letter or number'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from('channels').insert({
      project_id: activeProject.id,
      name: clean,
      description: description.trim(),
      created_by: currentUserId,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setName(''); setDescription('');
    onCreated();
    onClose();
  };

  return (
    <div data-skin="chat-dark" style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: 'var(--bg-card)',
        border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-card)',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1-chat)' }}>New channel</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-3-chat)', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); submit(); }}>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="channel-name"
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 12,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-chat)',
              borderRadius: 'var(--radius-chip)', color: 'var(--text-1-chat)', fontSize: 13,
            }}
          />
          <input
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{
              width: '100%', padding: '10px 12px', marginBottom: 16,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-chat)',
              borderRadius: 'var(--radius-chip)', color: 'var(--text-1-chat)', fontSize: 13,
            }}
          />
          {err && <div style={{ color: 'var(--danger-chat)', fontSize: 12, marginBottom: 12 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 14px', background: 'transparent', color: 'var(--text-2-chat)',
              border: '1px solid var(--border-chat)', borderRadius: 'var(--radius-chip)', cursor: 'pointer',
            }}>Cancel</button>
            <button type="submit" disabled={busy} style={{
              padding: '8px 14px', background: 'var(--accent)', color: '#09090b',
              border: 'none', borderRadius: 'var(--radius-chip)', cursor: 'pointer', fontWeight: 600,
            }}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
