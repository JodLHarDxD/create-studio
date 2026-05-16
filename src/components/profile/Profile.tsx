import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { User, Activity, Github, Trophy, CheckCircle2, Edit3, Save, X, Loader2 } from 'lucide-react';

export default function Profile() {
  const { profile, tasks, currentUserId, userRole, loginState, setProfile } = useWorkspace();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', bio: '', github_url: '' });

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      github_url: profile?.github_url || '',
    });
  }, [profile]);

  const myTasks = tasks.filter(t => t.assignee_id === currentUserId);
  const completedTasks = myTasks.filter(t => t.status === 'DONE').length;

  const handleSave = async () => {
    if (loginState === 'guest') { setIsEditing(false); return; }
    if (!currentUserId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name, bio: form.bio, github_url: form.github_url, updated_at: new Date().toISOString(),
      }).eq('id', currentUserId);
      if (error) throw error;
      if (profile) setProfile({ ...profile, ...form });
      setIsEditing(false);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  const displayEmail = profile?.email || 'unknown@creat.studio';

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', outline: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '8px 0',
    color: '#f7f3ee', fontFamily: '"DM Sans", sans-serif',
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar pb-12" style={{ background: '#0a0a0a' }}>
      <div className="max-w-4xl mx-auto p-10">

        {/* Header row */}
        <div className="flex items-start gap-8 pb-12 mb-12" style={{ borderBottom: '1px solid var(--border-1)' }}>

          {/* Avatar */}
          <div className="w-24 h-24 flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderTop: '2px solid rgba(245,158,11,0.4)' }}>
            <User size={36} style={{ color: '#f59e0b', opacity: 0.4 }} />
          </div>

          {/* Info / edit form */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { label: 'Name', key: 'full_name' as const, type: 'input', style: { fontSize: 20, fontFamily: '"Syne", sans-serif', fontWeight: 800, letterSpacing: '-0.02em' } },
                  { label: 'Bio', key: 'bio' as const, type: 'textarea' },
                  { label: 'GitHub URL', key: 'github_url' as const, type: 'input', placeholder: 'https://github.com/…' },
                ].map(({ label, key, type, style: extraStyle, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 6 }}>{label}</label>
                    {type === 'textarea'
                      ? <textarea value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} rows={3}
                          className="w-full outline-none resize-none custom-scrollbar" style={{ ...inputStyle, fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }} />
                      : <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                          style={{ ...inputStyle, fontSize: 13, ...extraStyle }} />
                    }
                  </div>
                ))}
              </div>
            ) : (
              <>
                <h1 style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 36, letterSpacing: '-0.025em', lineHeight: 1, color: '#f7f3ee', marginBottom: 16 }}>
                  {form.full_name || 'Operative'}
                </h1>
                <div className="flex gap-2 items-center flex-wrap" style={{ marginBottom: 16 }}>
                  {[
                    { content: <><Activity size={10} /> {userRole}</>, amber: true },
                    { content: displayEmail },
                  ].map((badge, i) => (
                    <span key={i} className="flex items-center gap-1"
                      style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', padding: '3px 8px',
                        border: badge.amber ? '1px solid rgba(245,158,11,0.3)' : '1px solid var(--border-2)',
                        color: badge.amber ? '#f59e0b' : '#5e5855',
                        background: badge.amber ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
                      {badge.content}
                    </span>
                  ))}
                  {form.github_url && (
                    <a href={form.github_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 transition-colors"
                      style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', padding: '3px 8px', border: '1px solid var(--border-2)', color: '#5e5855' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f7f3ee'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5e5855'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}>
                      <Github size={10} /> GitHub
                    </a>
                  )}
                </div>
                {form.bio && <p style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#5e5855', lineHeight: 1.7, maxWidth: 560, whiteSpace: 'pre-wrap' }}>{form.bio}</p>}
              </>
            )}
          </div>

          {/* Stats + actions */}
          <div className="flex flex-col items-end gap-6 shrink-0">
            <div className="text-right">
              <div style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', marginBottom: 4 }}>Tasks Done</div>
              <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 48, lineHeight: 1, letterSpacing: '-0.02em', color: '#f59e0b' }}>{completedTasks}</div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-2 transition-all"
                    style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid var(--border-2)', color: '#5e5855' }}>
                    <X size={11} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 transition-all"
                    style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', background: '#f59e0b', color: '#000', opacity: isSaving ? 0.6 : 1 }}>
                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 transition-all"
                  style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <Edit3 size={11} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <Trophy size={12} style={{ color: '#f59e0b', opacity: 0.6 }} />
              <span style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855' }}>Recent Activity</span>
            </div>
            <div style={{ border: '1px solid var(--border-1)', background: '#000' }}>
              {myTasks.filter(t => t.status === 'DONE').map(t => (
                <div key={t.id} className="flex items-start gap-3 p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <CheckCircle2 size={13} style={{ color: '#4ade80', marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontFamily: '"DM Sans", sans-serif', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#f7f3ee' }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 10, color: '#3a3836', marginTop: 2 }}>{t.description}</div>}
                  </div>
                </div>
              ))}
              {completedTasks === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a3836' }}>No completed tasks yet.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', marginBottom: 20 }}>Details</div>
            <div style={{ border: '1px solid var(--border-1)', background: '#000', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'User ID', value: currentUserId, mono: true, truncate: true },
                { label: 'Role', value: userRole, mono: true, amber: true },
                { label: 'Tasks Assigned', value: String(myTasks.length), mono: true },
                { label: 'Completion Rate', value: `${myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0}%`, mono: true },
              ].map(({ label, value, mono, truncate, amber }) => (
                <div key={label}>
                  <div style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3a3836', marginBottom: 4 }}>{label}</div>
                  <div className={truncate ? 'truncate' : ''} style={{ fontSize: truncate ? 9 : 11, fontFamily: mono ? '"JetBrains Mono", monospace' : '"DM Sans", sans-serif', color: amber ? '#f59e0b' : '#a09590', fontWeight: amber ? 700 : 400 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
