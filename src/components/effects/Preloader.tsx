import { motion, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);

  const springProgress = useSpring(0, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(timer); return 100; }
        return prev + Math.random() * 2.2;
      });
    }, 55);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    springProgress.set(progress);
    if (progress >= 100) setTimeout(onComplete, 900);
  }, [progress, onComplete, springProgress]);

  const displayProgress = useTransform(springProgress, v => Math.round(v));
  const ruleWidth = useTransform(springProgress, [0, 100], ['0%', '100%']);
  const wordmarkInk = useTransform(springProgress, [0, 100], ['0%', '100%']);

  return (
    <motion.div
      id="preloader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col select-none pointer-events-none overflow-hidden"
      style={{ background: '#09090b' }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(52,211,153,0.06), transparent 70%)',
        }}
      />

      {/* Top masthead */}
      <div className="absolute top-10 left-12 right-12 flex justify-between items-baseline z-10">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-emerald-400/80 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Volume 01 — Cinematic Edition
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500"
        >
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase()}
        </motion.span>
      </div>

      {/* Centerpiece — giant italic CREATstudio wordmark */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
          style={{ padding: '0 4vw' }}
        >
          {/* Base — zinc layer */}
          <h1
            className="leading-[0.85] tracking-tight"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(4rem, 14vw, 14rem)',
              letterSpacing: '-0.03em',
              color: '#27272a',
            }}
          >
            creat
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontStyle: 'normal',
                fontWeight: 300,
                letterSpacing: '0.05em',
                fontSize: '0.32em',
                color: '#52525b',
                marginLeft: '0.15em',
                verticalAlign: 'top',
              }}
            >
              /studio
            </span>
          </h1>

          {/* Emerald sweep overlay */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ width: wordmarkInk }}
          >
            <h1
              className="leading-[0.85] tracking-tight whitespace-nowrap"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(4rem, 14vw, 14rem)',
                letterSpacing: '-0.03em',
                color: '#34d399',
                textShadow: '0 0 40px rgba(52,211,153,0.35)',
              }}
            >
              creat
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontStyle: 'normal',
                  fontWeight: 300,
                  letterSpacing: '0.05em',
                  fontSize: '0.32em',
                  color: '#8b5cf6',
                  marginLeft: '0.15em',
                  verticalAlign: 'top',
                  opacity: 0.9,
                }}
              >
                /studio
              </span>
            </h1>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom — hairline rule + counter */}
      <div className="absolute bottom-10 left-12 right-12 z-10">
        <div className="relative w-full mb-5 h-px bg-white/[0.08]">
          <motion.div
            className="absolute left-0 top-0 h-px"
            style={{
              width: ruleWidth,
              background: 'linear-gradient(90deg, #34d399, #8b5cf6)',
              boxShadow: '0 0 8px rgba(52,211,153,0.6)',
            }}
          />
        </div>

        <div className="flex justify-between items-baseline">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="font-display italic text-zinc-200"
            style={{ fontSize: 16, letterSpacing: '-0.01em' }}
          >
            A studio for teams that ship.
          </motion.span>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-500">Loading</span>
            <motion.span
              className="font-mono text-zinc-100"
              style={{
                fontSize: 32,
                fontWeight: 400,
                fontVariantNumeric: 'tabular-nums',
                minWidth: '3ch',
                textAlign: 'right',
              }}
            >
              {displayProgress}
            </motion.span>
            <span className="font-mono text-zinc-600" style={{ fontSize: 14 }}>/100</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
