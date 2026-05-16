import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2, Zap } from 'lucide-react';
import { variants, transitions } from '@/design';
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
    setLoading(true); setError('');
    try {
      if (mode === 'register') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (signUpErr) throw signUpErr;
        if (data.user) {
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
          const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          setCurrentUserId(data.user.id);
          if (prof) { setUserRole(prof.role); setProfile(prof); }
          setLoginState('logged_in');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  const handleGuest = () => {
    setCurrentUserId('demo-1'); setUserRole('ADMIN'); setLoginState('guest');
    setProfile({ id: 'demo-1', email: 'admin@kinetix.os', full_name: 'Admin Demo', role: 'ADMIN', created_at: new Date().toISOString() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      <WebGLBackground />
      <NoiseOverlay />

      <motion.div
        variants={variants.cinematicReveal}
        initial="hidden"
        animate="visible"
        className="relative z-20 w-[420px] border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md"
      >
        <motion.div
          variants={variants.staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={variants.staggerChild} className="p-8 border-b border-white/10 flex items-center gap-4">
            <div className="w-8 h-8 bg-white flex items-center justify-center">
              <Zap size={16} className="text-black" fill="black" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.3em]">Kinetix OS</div>
              <div className="text-[9px] uppercase tracking-widest opacity-40">Developer Workspace</div>
            </div>
          </motion.div>

          <div className="p-8">
            <motion.div variants={variants.staggerChild} className="flex gap-1 mb-8 border border-white/10 p-1">
              {(['login', 'register'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${mode === m ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}>
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={transitions.fast}
                className="mb-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-mono"
              >
                {error}
              </motion.div>
            )}

            <motion.form variants={variants.staggerChild} onSubmit={handleAuth} className="flex flex-col gap-3">
              {mode === 'register' && (
                <>
                  <input type="text" placeholder="FULL NAME" value={fullName}
                    onChange={e => setFullName(e.target.value)} required
                    className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
                  <select value={role} onChange={e => setRole(e.target.value as any)}
                    className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60">
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </>
              )}
              <input type="email" placeholder="EMAIL ADDRESS" value={email}
                onChange={e => setEmail(e.target.value)} required
                className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
              <input type="password" placeholder="PASSWORD" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6}
                className="bg-black border border-white/20 p-3 text-[11px] uppercase tracking-wider text-white outline-none focus:border-white/60 transition-colors" />
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={transitions.fast}
                className="mt-2 bg-white text-black py-4 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {mode === 'login' ? 'Authenticate' : 'Create Account'}
              </motion.button>
            </motion.form>

            <motion.div variants={variants.staggerChild} className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
              <button onClick={handleGuest} className="text-[9px] uppercase tracking-widest font-bold text-yellow-500/50 hover:text-yellow-500 transition-colors">
                Demo Guest Access (Admin View)
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
