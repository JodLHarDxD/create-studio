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

  const displayEmail = profile?.email || 'unknown@kinetix.os';

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0a] p-12 custom-scrollbar pb-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-8 border-b border-white/10 pb-12 mb-12">
          <div className="w-28 h-28 bg-white/5 border border-white/20 flex items-center justify-center shrink-0">
            <User size={44} className="opacity-20" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block mb-1">Name</label>
                  <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    className="w-full bg-black border border-white/20 p-2 text-xl font-black uppercase tracking-tighter outline-none focus:border-white" />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block mb-1">Bio</label>
                  <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3}
                    className="w-full bg-black border border-white/20 p-3 text-sm font-mono outline-none focus:border-white resize-none custom-scrollbar" />
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block mb-1">GitHub URL</label>
                  <input value={form.github_url} onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))}
                    placeholder="https://github.com/..."
                    className="w-full bg-black border border-white/20 p-2 text-xs outline-none focus:border-white" />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-3">{form.full_name || 'Operative'}</h1>
                <div className="flex gap-3 items-center mb-4 text-[9px] uppercase tracking-widest font-bold opacity-60 flex-wrap">
                  <span className="flex items-center gap-1 border border-white/20 px-2 py-1"><Activity size={11} /> {userRole}</span>
                  <span className="flex items-center gap-1 border border-white/20 px-2 py-1">{displayEmail}</span>
                  {form.github_url && (
                    <a href={form.github_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 border border-white/20 px-2 py-1 hover:bg-white/10 transition-colors">
                      <Github size={11} /> GitHub
                    </a>
                  )}
                </div>
                {form.bio && <p className="opacity-60 text-sm font-mono max-w-2xl whitespace-pre-wrap">{form.bio}</p>}
              </>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-6 shrink-0">
            <div>
              <div className="text-[9px] uppercase font-black tracking-widest opacity-40 mb-1">Tasks Done</div>
              <div className="text-5xl font-black italic tracking-tighter">{completedTasks}</div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} disabled={isSaving}
                    className="flex items-center gap-1.5 border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/5 text-white/50">
                    <X size={12} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={isSaving}
                    className="flex items-center gap-1.5 bg-white text-black px-4 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-50">
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 border border-white px-3 py-2 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                  <Edit3 size={12} /> Edit
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <h2 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={13} /> Recent Activity
            </h2>
            <div className="border border-white/10 bg-black divide-y divide-white/5">
              {myTasks.filter(t => t.status === 'DONE').map(t => (
                <div key={t.id} className="p-4 flex items-start gap-3">
                  <CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold text-[11px] uppercase tracking-wider">{t.title}</div>
                    {t.description && <div className="text-[10px] opacity-40 mt-0.5">{t.description}</div>}
                  </div>
                </div>
              ))}
              {completedTasks === 0 && (
                <div className="p-8 text-center text-[10px] uppercase font-bold tracking-widest opacity-30">No completed tasks yet.</div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest mb-4">Details</h2>
            <div className="border border-white/10 bg-black p-5 space-y-4">
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 mb-1">User ID</div>
                <div className="font-mono text-[9px] break-all opacity-60">{currentUserId}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 mb-1">Role</div>
                <div className="font-mono text-[10px] font-black">{userRole}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 mb-1">Tasks Assigned</div>
                <div className="font-mono text-[10px]">{myTasks.length}</div>
              </div>
              <div>
                <div className="text-[8px] uppercase font-bold opacity-40 mb-1">Completion Rate</div>
                <div className="font-mono text-[10px]">{myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
