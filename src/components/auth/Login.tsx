import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';
import { transitions } from '@/design';
import WebGLBackground from '@/components/effects/WebGLBackground';
import NoiseOverlay from '@/components/effects/NoiseOverlay';

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
    setProfile({ id: 'demo-1', email: 'admin@creat.studio', full_name: 'Admin Demo', role: 'ADMIN', created_at: new Date().toISOString() });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', outline: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '11px 0', fontSize: 13,
    fontFamily: '"DM Sans", sans-serif', color: '#f7f3ee',
    transition: 'border-color 0.2s',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderBottomColor = '#f59e0b');
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.target.style.borderBottomColor = 'rgba(255,255,255,0.1)');

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden" style={{ background: '#030303' }}>

      {/* ── LEFT: Brand panel ── */}
      <div className="relative flex-1 flex flex-col justify-between p-14 overflow-hidden">
        <WebGLBackground />
        <NoiseOverlay />

        {/* Top micro-label */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="relative z-10"
        >
          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3a3836' }}>
            v2.0 — Developer Workspace
          </span>
        </motion.div>

        {/* Hero wordmark */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            style={{ lineHeight: 0.82, userSelect: 'none' }}
          >
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 900,
              fontStyle: 'italic',
              fontSize: 'clamp(72px, 9vw, 130px)',
              letterSpacing: '-0.03em',
              color: '#f7f3ee',
              textTransform: 'uppercase',
            }}>
              CREAT
            </div>
            <div style={{
              fontFamily: '"Syne", sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(50px, 6.3vw, 91px)',
              letterSpacing: '-0.03em',
              color: '#f59e0b',
              textTransform: 'uppercase',
            }}>
              STUDIO
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            style={{ marginTop: 32, fontSize: 13, fontFamily: '"DM Sans", sans-serif', color: '#5e5855', lineHeight: 1.7, maxWidth: 340 }}
          >
            Precision-built for teams that ship. Task management, live code review, and AI assistance — unified.
          </motion.p>

          {/* Ambient line decoration */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
            style={{ marginTop: 40, height: 1, width: 80, background: 'linear-gradient(90deg, #f59e0b, transparent)', transformOrigin: 'left' }}
          />
        </div>

        {/* Bottom left corner marker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="relative z-10"
          style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.2em', color: '#3a3836', textTransform: 'uppercase' }}
        >
          creat.studio © 2025
        </motion.div>
      </div>

      {/* ── RIGHT: Auth panel ── */}
      <motion.div
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex flex-col justify-center shrink-0"
        style={{
          width: 420,
          background: '#080808',
          borderLeft: '1px solid rgba(245,158,11,0.1)',
          padding: '64px 52px',
        }}
      >
        {/* Panel header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 800, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f7f3ee', marginBottom: 6 }}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </div>
          <div style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a3836' }}>
            to CREATstudio workspace
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 24 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className="pb-3 transition-all"
              style={{
                fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: mode === m ? '#f59e0b' : '#3a3836',
                borderBottom: `2px solid ${mode === m ? '#f59e0b' : 'transparent'}`,
                marginBottom: -1,
              }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.fast}
            style={{ marginBottom: 20, padding: '10px 14px', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.05)', color: '#f87171', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.5 }}
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {mode === 'register' && (
            <>
              <div>
                <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 8 }}>Full Name</label>
                <input type="text" placeholder="Your name" value={fullName}
                  onChange={e => setFullName(e.target.value)} required
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
              </div>
              <div>
                <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 8 }}>Role</label>
                <select value={role} onChange={e => setRole(e.target.value as any)}
                  style={{ ...inputStyle, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#a09590', letterSpacing: '0.08em' }}
                  onFocus={handleFocus as any} onBlur={handleBlur as any}>
                  <option value="MEMBER" style={{ background: '#080808' }}>Member</option>
                  <option value="ADMIN" style={{ background: '#080808' }}>Admin</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 8 }}>Email</label>
            <input type="email" placeholder="you@company.com" value={email}
              onChange={e => setEmail(e.target.value)} required
              style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          <div>
            <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 8 }}>Password</label>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={transitions.fast}
            style={{
              marginTop: 8,
              padding: '16px',
              background: '#f59e0b',
              color: '#000',
              fontSize: 10,
              fontFamily: '"Syne", sans-serif',
              fontWeight: 800,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {mode === 'login' ? 'Authenticate' : 'Create Account'}
          </motion.button>
        </form>

        {/* Guest */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <button onClick={handleGuest}
            style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a3836', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}>
            Demo Guest Access → Admin View
          </button>
        </div>
      </motion.div>
    </div>
  );
}
