import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2, ArrowRight } from 'lucide-react';
import { transitions } from '@/design';

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

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 90% 70% at 50% -10%, rgba(191,74,42,0.05) 0%, transparent 55%), #F4EFE6',
      }}
    >
      {/* ── LEFT: Editorial brand panel ── */}
      <div className="relative flex-1 flex flex-col justify-between" style={{ padding: '56px 64px' }}>
        {/* Top masthead */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-between items-baseline"
        >
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#6B645C',
            }}
          >
            Volume 01 — Studio Edition
          </span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#6B645C',
            }}
          >
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </span>
        </motion.div>

        {/* Hero — giant italic display */}
        <div>
          <motion.div
            initial={{ opacity: 0, filter: 'blur(6px)', y: 24 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            <h1
              style={{
                fontFamily: '"Fraunces", serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(72px, 9.5vw, 168px)',
                lineHeight: 0.88,
                letterSpacing: '-0.03em',
                color: '#1A1612',
                fontFeatureSettings: '"ss01" 1, "swsh" 1',
                margin: 0,
              }}
            >
              A studio
              <br />
              for teams
              <br />
              that&nbsp;
              <span style={{ color: '#BF4A2A' }}>ship.</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
            style={{
              marginTop: 44,
              height: 1,
              width: 96,
              background: '#1A1612',
              transformOrigin: 'left',
            }}
          />

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 24,
              fontSize: 15,
              fontFamily: '"Inter", sans-serif',
              fontWeight: 400,
              color: '#1A1612',
              lineHeight: 1.65,
              maxWidth: 420,
            }}
          >
            Tasks, files, and an{' '}
            <span className="italic-display">AI cortex</span> — bound in a single editorial workspace
            for teams that care how the work feels.
          </motion.p>
        </div>

        {/* Bottom marginalia */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex justify-between items-baseline"
        >
          <span
            style={{
              fontFamily: '"Fraunces", serif',
              fontStyle: 'italic',
              fontSize: 13,
              color: '#6B645C',
            }}
          >
            creat / studio
          </span>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.15em',
              color: '#9B948A',
              textTransform: 'uppercase',
            }}
          >
            № 001 / Edition
          </span>
        </motion.div>
      </div>

      {/* ── RIGHT: Auth column ── */}
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        className="flex flex-col justify-center shrink-0 relative"
        style={{
          width: 460,
          background: '#FBF8F2',
          borderLeft: '1px solid rgba(26,22,18,0.10)',
          padding: '64px 56px',
        }}
      >
        {/* Hairline column accent */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: 56,
            width: 32,
            height: 1,
            background: '#BF4A2A',
          }}
        />

        {/* Panel header */}
        <div style={{ marginBottom: 40, marginTop: 12 }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9B948A',
              marginBottom: 16,
            }}
          >
            {mode === 'login' ? 'Returning' : 'New to the studio'}
          </div>
          <div
            style={{
              fontFamily: '"Fraunces", serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 38,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#1A1612',
              fontFeatureSettings: '"ss01" 1, "swsh" 1',
            }}
          >
            {mode === 'login' ? 'Welcome back.' : 'Make an entry.'}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-8" style={{ borderBottom: '1px solid rgba(26,22,18,0.10)', gap: 28 }}>
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className="pb-3 transition-all"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: mode === m ? '#1A1612' : '#9B948A',
                borderBottom: `1px solid ${mode === m ? '#BF4A2A' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
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
            transition={transitions.fast}
            style={{
              marginBottom: 22,
              padding: '12px 14px',
              border: '1px solid rgba(181,60,42,0.22)',
              background: 'rgba(181,60,42,0.06)',
              color: '#B53C2A',
              fontSize: 12,
              fontFamily: '"Inter", sans-serif',
              lineHeight: 1.55,
              borderRadius: 2,
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="reg-name" className="form-label">Full Name</label>
                <input
                  id="reg-name" type="text" placeholder="Your name" value={fullName}
                  onChange={e => setFullName(e.target.value)} required
                  className="input-contained"
                />
              </div>
              <div>
                <label htmlFor="reg-role" className="form-label">Role</label>
                <select
                  id="reg-role" value={role} onChange={e => setRole(e.target.value as any)}
                  className="input-contained"
                  style={{ fontFamily: '"Inter", sans-serif', cursor: 'pointer' }}
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
              id="auth-email" type="email" placeholder="you@studio.com" value={email}
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

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={loading ? {} : { y: -1 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 12,
              padding: '14px 22px',
              background: '#1A1612',
              color: '#F4EFE6',
              fontFamily: '"Inter", sans-serif',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 2,
              border: '1px solid #1A1612',
              opacity: loading ? 0.65 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.25s, border-color 0.25s',
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background = '#BF4A2A';
                (e.currentTarget as HTMLElement).style.borderColor = '#BF4A2A';
              }
            }}
            onMouseLeave={e => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background = '#1A1612';
                (e.currentTarget as HTMLElement).style.borderColor = '#1A1612';
              }
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>{mode === 'login' ? 'Enter the studio' : 'Create account'}</span>
            {!loading && <ArrowRight size={14} />}
          </motion.button>
        </form>

        {/* Guest divider + link */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid rgba(26,22,18,0.10)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9B948A',
              marginBottom: 10,
            }}
          >
            Or look around
          </div>
          <button
            type="button"
            onClick={handleGuest}
            className="link-editorial"
            style={{
              fontFamily: '"Fraunces", serif',
              fontStyle: 'italic',
              fontSize: 15,
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            Enter as guest — admin view
          </button>
        </div>
      </motion.div>
    </div>
  );
}
