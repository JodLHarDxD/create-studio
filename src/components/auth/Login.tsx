import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2, ArrowRight, Sparkles } from 'lucide-react';
import WebGLBackground from '../effects/WebGLBackground';
import { MagneticButton, RevealText } from '../primitives';

export default function Login() {
  const { setLoginState, setCurrentUserId, setUserRole, setProfile } = useWorkspace();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, or use Demo Guest Access below.');
      return;
    }
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (signUpErr) {
          if (signUpErr.message.toLowerCase().includes('already')) {
            setMode('login');
            setError('Account already exists — please sign in.');
          } else {
            throw signUpErr;
          }
          return;
        }
        if (!data.session) {
          setMode('login');
          setError('Account exists or confirmation sent — please sign in with your password.');
          return;
        }
        if (data.user && data.session) {
          await supabase.from('profiles').upsert({
            id: data.user.id, email, full_name: fullName, role,
          }, { onConflict: 'id' });
          setCurrentUserId(data.user.id);
          setUserRole(role);
          setProfile({ id: data.user.id, email, full_name: fullName, role, created_at: new Date().toISOString() });
          setLoginState('logged_in');
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        if (data.user) {
          setCurrentUserId(data.user.id);
          setLoginState('logged_in');
          supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: prof }) => {
            if (prof) { setUserRole(prof.role); setProfile(prof); }
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  const handleGuest = () => {
    setCurrentUserId('demo-1'); setUserRole('ADMIN'); setLoginState('guest');
    setProfile({ id: 'demo-1', email: 'admin@forge.dev', full_name: 'Admin Demo', role: 'ADMIN', created_at: new Date().toISOString() });
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden text-zinc-200 antialiased" style={{ fontFamily: '"Inter", sans-serif' }}>
      <WebGLBackground />

      {/* ── LEFT: Cinematic editorial brand panel ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-between" style={{ padding: '56px 64px' }}>
        {/* Top masthead */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-between items-baseline"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border border-white/[0.10] flex items-center justify-center bg-zinc-950/40 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5">
              <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-emerald-400">
                Volume 01 — Cinematic Edition
              </span>
              <span className="block font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-600">
                Deployment Environment Secure
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-[0.20em] uppercase text-zinc-500">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase()}
          </span>
        </motion.div>

        {/* Hero */}
        <div className="max-w-5xl">
          <div className="flex items-center gap-2 mb-6 text-emerald-400 font-mono text-[10px] tracking-[0.25em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Neural Engineering Console — Online
          </div>

          <motion.h1
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-zinc-100 leading-[0.95] tracking-tight"
            style={{ fontSize: 'clamp(56px, 8.5vw, 144px)', fontWeight: 300, fontStyle: 'italic' }}
          >
            <RevealText text="Automating" />
            <br />
            <RevealText text="engineering," delay={0.15} />
            <br />
            <span className="text-emerald-400 italic">cinematically.</span>
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
            className="mt-12 h-px w-24 bg-emerald-400/60 origin-left"
          />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-sans text-sm text-zinc-400 leading-relaxed max-w-md"
          >
            Tasks, files, and a multi-model <span className="italic-display text-zinc-200">AI cortex</span> —
            bound in a single editorial console for teams that ship at speed.
          </motion.p>
        </div>

        {/* Bottom marginalia */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex justify-between items-baseline pt-8 border-t border-white/[0.06]"
        >
          <span className="font-display italic text-sm text-zinc-400">
            forge / neural console
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-600">
            №&nbsp;001 / Cinematic Edition
          </span>
        </motion.div>
      </div>

      {/* ── RIGHT: Auth column ── */}
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        className="relative z-10 flex flex-col justify-center shrink-0 border-l border-white/[0.08] bg-zinc-950/70 backdrop-blur-2xl"
        style={{ width: 480, padding: '64px 56px' }}
      >
        {/* Hairline accent */}
        <div className="absolute top-14 left-14 w-10 h-px bg-emerald-400" />

        {/* Panel header */}
        <div className="mt-3 mb-10">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-4">
            {mode === 'login' ? 'Returning Operator' : 'New To Forge'}
          </div>
          <h2
            className="font-display text-zinc-100"
            style={{ fontStyle: 'italic', fontWeight: 400, fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em' }}
          >
            {mode === 'login' ? 'Welcome back.' : 'Make an entry.'}
          </h2>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-8 gap-7 border-b border-white/[0.08]">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className="pb-3 font-mono text-[10px] tracking-[0.20em] uppercase transition-colors duration-300 -mb-px"
              style={{
                color: mode === m ? '#f4f4f5' : '#71717a',
                borderBottom: `1px solid ${mode === m ? '#34d399' : 'transparent'}`,
              }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-5 px-3.5 py-3 border border-red-400/30 bg-red-500/[0.06] text-red-300 text-[12px] leading-relaxed"
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="reg-name" className="form-label">Full Name</label>
                <input
                  id="reg-name" type="text" placeholder="Operator name" value={fullName}
                  onChange={e => setFullName(e.target.value)} required
                  className="input-contained"
                />
              </div>
              <div>
                <label htmlFor="reg-role" className="form-label">Role</label>
                <select
                  id="reg-role" value={role} onChange={e => setRole(e.target.value as any)}
                  className="input-contained cursor-pointer"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="form-label">Email</label>
            <input
              id="auth-email" type="email" placeholder="you@forge.dev" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="input-contained"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="form-label">Password</label>
            <input
              id="auth-password" type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              className="input-contained"
            />
          </div>

          <MagneticButton
            type="submit"
            disabled={loading}
            className="mt-3 flex items-center justify-center gap-2.5 bg-zinc-100 text-zinc-950 font-mono text-[10px] font-semibold tracking-[0.20em] uppercase px-6 py-3.5 hover:bg-emerald-400 transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed border border-zinc-100 hover:border-emerald-400"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            <span>{mode === 'login' ? 'Initialize Matrix' : 'Create Account'}</span>
            {!loading && <ArrowRight size={13} strokeWidth={2} />}
          </MagneticButton>
        </form>

        {/* Guest divider */}
        <div className="mt-8 pt-6 border-t border-white/[0.08] text-center">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500 mb-3">
            Or look around
          </div>
          <button
            type="button"
            onClick={handleGuest}
            className="font-display italic text-[15px] text-zinc-200 hover:text-emerald-400 transition-colors duration-300 border-b border-white/20 hover:border-emerald-400 pb-0.5"
          >
            Enter as guest — admin view
          </button>
        </div>
      </motion.div>
    </div>
  );
}
