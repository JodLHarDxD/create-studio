import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);

  const springProgress = useSpring(0, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(timer); return 100; }
        return prev + Math.random() * 2;
      });
    }, 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    springProgress.set(progress);
    if (progress >= 100) setTimeout(onComplete, 1200);
  }, [progress, onComplete, springProgress]);

  const displayProgress = useTransform(springProgress, v => Math.round(v));

  const maskPath = useTransform(springProgress, [0, 100], [
    'polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%)',
    'polygon(-50% 150%, 150% 150%, 150% -50%, -50% -50%)',
  ]);

  return (
    <div
      id="preloader"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] select-none pointer-events-none overflow-hidden"
    >
      {/* Technical grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* Scanning line */}
      <motion.div
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-[10vh] bg-gradient-to-b from-transparent via-orange-500/5 to-transparent z-0"
      />

      <div className="relative z-10">
        {/* Background text — dim unfilled */}
        <h1 className="text-[12vw] leading-none uppercase tracking-tighter text-[#151515] select-none">
          <span className="font-serif italic font-black">CREAT</span>
          <span className="font-sans font-black">studio</span>
        </h1>

        {/* Liquid foreground layer — diagonal mask sweep */}
        <motion.div className="absolute inset-0 overflow-hidden" style={{ clipPath: maskPath }}>
          <div className="relative w-full h-full">
            <div className="absolute inset-0 flex">
              <h1 className="text-[12vw] leading-none uppercase tracking-tighter">
                <span className="font-serif italic font-black text-white">CREAT</span>
                <span className="font-sans font-black text-orange-500">studio</span>
              </h1>
            </div>

            {/* Wave crest */}
            <motion.div
              className="absolute w-[200%] h-40 -left-1/2"
              style={{
                top: useTransform(springProgress, [0, 100], ['100%', '0%']),
                rotate: -15,
              }}
            >
              <motion.svg
                className="w-full h-full fill-white/20"
                viewBox="0 0 1000 100"
                preserveAspectRatio="none"
                animate={{ x: ['-25%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <path d="M0,50 C250,100 750,0 1000,50 L1000,100 L0,100 Z" />
              </motion.svg>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Technical metadata footer */}
      <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end z-10">
        <div className="flex flex-col gap-2 font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase">
          <div className="flex items-center gap-4">
            <span className="text-orange-500/50">Node:</span>
            <span>SS-207 // QUANTUM-A</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-orange-500/50">Target:</span>
            <span>SS-216 // NEURAL-STR</span>
          </div>
        </div>

        <div className="flex items-baseline gap-6 font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[8px] uppercase tracking-[0.5em] text-white/40 mb-1">Process Status</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-white/20">Syncing Stream</span>
              <motion.span className="text-orange-500 font-bold text-xl min-w-[3ch] text-right">
                {displayProgress}
              </motion.span>
              <span className="text-orange-500 text-sm font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-1 bg-orange-500 z-20 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
        style={{ width: useTransform(springProgress, [0, 100], ['0%', '100%']) }}
      />
    </div>
  );
}
