import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/lib/supabaseClient';
import { User, Activity, Github, Trophy, CheckCircle2, Edit3, Save, X, Loader2, Camera } from 'lucide-react';

async function resizeToDataUrl(file: File, maxPx = 128, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function Profile() {
  const { profile, tasks, currentUserId, userRole, loginState, setProfile } = useWorkspace();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ full_name: '', bio: '', github_url: '' });
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loginState === 'guest' || !currentUserId) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const { error } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', currentUserId);
      if (error) throw error;
      if (profile) setProfile({ ...profile, avatar_url: dataUrl });
    } catch (err: any) {
      alert(`Avatar upload failed: ${err.message}`);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const displayEmail = profile?.email || 'unknown@creat.studio';

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', outline: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '8px 0',
    color: '#f4f4f5', fontFamily: '"Inter", sans-serif',
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar pb-12 bg-zinc-950/40">
      <div className="max-w-4xl mx-auto p-10">

        {/* Header */}
        <div className="flex items-start gap-8 pb-10 mb-12 border-b border-white/[0.06]">

          {/* Avatar */}
          <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
            <div
              className="w-24 h-24 flex items-center justify-center overflow-hidden cursor-pointer bg-emerald-500/[0.08] border border-emerald-400/40"
              onClick={() => loginState !== 'guest' && avatarInputRef.current?.click()}
              title={loginState === 'guest' ? 'Login to upload avatar' : 'Change profile picture'}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-emerald-400/60" strokeWidth={1.5} />
              )}
            </div>

            {loginState !== 'guest' && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex items-center justify-center transition-all w-7 h-7 bg-emerald-400 border-2 border-zinc-950 text-zinc-950 hover:bg-emerald-300"
                title="Change profile picture"
              >
                {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} strokeWidth={1.8} />}
              </button>
            )}

            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Info / edit form */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-5">
                {[
                  { label: 'Name', key: 'full_name' as const, type: 'input', extra: { fontSize: 24, fontFamily: '"Playfair Display", serif', fontWeight: 400, letterSpacing: '-0.02em', fontStyle: 'italic' as const } },
                  { label: 'Bio', key: 'bio' as const, type: 'textarea' },
                  { label: 'GitHub URL', key: 'github_url' as const, type: 'input', placeholder: 'https://github.com/…' },
                ].map(({ label, key, type, extra, placeholder }) => (
                  <div key={key}>
                    <label className="form-label">{label}</label>
                    {type === 'textarea'
                      ? <textarea value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} rows={3}
                          className="w-full outline-none resize-none custom-scrollbar" style={{ ...inputStyle, fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }} />
                      : <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                          style={{ ...inputStyle, fontSize: 13, ...(extra ?? {}) }} />
                    }
                  </div>
                ))}
              </div>
            ) : (
              <>
                <h1
                  className="font-display italic text-zinc-100 mb-4"
                  style={{ fontSize: 52, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1 }}
                >
                  {form.full_name || 'Operative'}
                </h1>
                <div className="flex gap-2 items-center flex-wrap mb-4">
                  {[
                    { content: <><Activity size={10} strokeWidth={1.5} /> {userRole}</>, accent: true },
                    { content: displayEmail },
                  ].map((badge, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 text-[9px] font-mono tracking-[0.20em] uppercase px-2.5 py-1 border"
                      style={{
                        borderColor: badge.accent ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.10)',
                        color: badge.accent ? '#34d399' : '#a1a1aa',
                        background: badge.accent ? 'rgba(52,211,153,0.06)' : 'transparent',
                      }}
                    >
                      {badge.content}
                    </span>
                  ))}
                  {form.github_url && (
                    <a
                      href={form.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 transition-colors text-[9px] font-mono tracking-[0.20em] uppercase px-2.5 py-1 border border-white/10 text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/40"
                    >
                      <Github size={10} /> GitHub
                    </a>
                  )}
                </div>
                {form.bio && (
                  <p className="text-[13px] text-zinc-400 leading-relaxed max-w-xl whitespace-pre-wrap font-display italic">
                    {form.bio}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Stats + actions */}
          <div className="flex flex-col items-end gap-6 shrink-0">
            <div className="text-right">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500 mb-2">Tasks Done</div>
              <div
                className="font-display italic text-emerald-400"
                style={{ fontSize: 64, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em' }}
              >
                {completedTasks}
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-2 transition-all text-[9px] font-mono tracking-[0.20em] uppercase border border-white/10 text-zinc-500 hover:text-zinc-200 hover:border-white/30"
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 transition-all text-[9px] font-mono tracking-[0.20em] uppercase bg-emerald-400 text-zinc-950 hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 transition-all text-[9px] font-mono tracking-[0.20em] uppercase border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                >
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
              <Trophy size={12} className="text-emerald-400/60" strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500">Recent Activity</span>
            </div>
            <div className="border border-white/[0.06] bg-zinc-900/40 backdrop-blur-md">
              {myTasks.filter(t => t.status === 'DONE').map(t => (
                <div key={t.id} className="flex items-start gap-3 p-4 border-b border-white/[0.04]">
                  <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="text-[12px] text-zinc-100 font-medium">{t.title}</div>
                    {t.description && <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t.description}</div>}
                  </div>
                </div>
              ))}
              {completedTasks === 0 && (
                <div className="p-8 text-center text-[10px] font-mono tracking-[0.20em] uppercase text-zinc-600">
                  No completed tasks yet.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-5">Details</div>
            <div className="border border-white/[0.06] bg-zinc-900/40 backdrop-blur-md p-5 flex flex-col gap-4">
              {[
                { label: 'User ID', value: currentUserId, mono: true, truncate: true },
                { label: 'Role', value: userRole, mono: true, accent: true },
                { label: 'Tasks Assigned', value: String(myTasks.length), mono: true },
                { label: 'Completion Rate', value: `${myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0}%`, mono: true },
              ].map(({ label, value, mono, truncate, accent }) => (
                <div key={label}>
                  <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-zinc-600 mb-1">{label}</div>
                  <div
                    className={truncate ? 'truncate' : ''}
                    style={{
                      fontSize: truncate ? 9 : 12,
                      fontFamily: mono ? '"JetBrains Mono", monospace' : '"Inter", sans-serif',
                      color: accent ? '#34d399' : '#d4d4d8',
                      fontWeight: accent ? 500 : 400,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
