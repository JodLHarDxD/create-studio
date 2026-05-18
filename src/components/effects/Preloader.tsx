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

  // Wordmark fill — terracotta inks over espresso as progress climbs
  const wordmarkInk = useTransform(springProgress, [0, 100], ['0%', '100%']);

  return (
    <motion.div
      id="preloader"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col select-none pointer-events-none overflow-hidden"
      style={{ background: '#F4EFE6' }}
    >
      {/* Editorial paper texture — barely-there grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(26,22,18,0.025) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          mixBlendMode: 'multiply',
          opacity: 0.6,
        }}
      />

      {/* Top masthead */}
      <div className="absolute top-10 left-12 right-12 flex justify-between items-baseline z-10">
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#6B645C',
          }}
        >
          Volume 01 — Studio Edition
        </motion.span>
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#6B645C',
          }}
        >
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
        </motion.span>
      </div>

      {/* Centerpiece — giant italic wordmark */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, filter: 'blur(8px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
          style={{ padding: '0 4vw' }}
        >
          {/* Base layer — espresso ink */}
          <h1
            className="leading-[0.85] tracking-tight"
            style={{
              fontFamily: '"Fraunces", serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(4rem, 14vw, 14rem)',
              letterSpacing: '-0.03em',
              color: '#1A1612',
              fontFeatureSettings: '"ss01" 1, "swsh" 1',
            }}
          >
            creat
            <span
              style={{
                fontFamily: '"Inter", sans-serif',
                fontStyle: 'normal',
                fontWeight: 300,
                letterSpacing: '-0.02em',
                color: '#6B645C',
                marginLeft: '0.05em',
              }}
            >
              /studio
            </span>
          </h1>

          {/* Terracotta overlay — sweeps left→right as progress fills */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ width: wordmarkInk }}
          >
            <h1
              className="leading-[0.85] tracking-tight whitespace-nowrap"
              style={{
                fontFamily: '"Fraunces", serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(4rem, 14vw, 14rem)',
                letterSpacing: '-0.03em',
                color: '#BF4A2A',
                fontFeatureSettings: '"ss01" 1, "swsh" 1',
              }}
            >
              creat
              <span
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontStyle: 'normal',
                  fontWeight: 300,
                  letterSpacing: '-0.02em',
                  color: '#BF4A2A',
                  marginLeft: '0.05em',
                  opacity: 0.85,
                }}
              >
                /studio
              </span>
            </h1>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom row — hairline rule + counter */}
      <div className="absolute bottom-10 left-12 right-12 z-10">
        {/* Hairline progress rule */}
        <div
          className="relative w-full mb-5"
          style={{ height: 1, background: 'rgba(26,22,18,0.13)' }}
        >
          <motion.div
            className="absolute left-0 top-0"
            style={{
              height: 1,
              width: ruleWidth,
              background: '#BF4A2A',
            }}
          />
        </div>

        <div className="flex justify-between items-baseline">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              fontFamily: '"Fraunces", serif',
              fontStyle: 'italic',
              fontSize: 16,
              color: '#1A1612',
              letterSpacing: '-0.01em',
            }}
          >
            A studio for teams that ship.
          </motion.span>

          <div className="flex items-baseline gap-3">
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#9B948A',
              }}
            >
              Loading
            </span>
            <motion.span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 28,
                fontWeight: 400,
                color: '#1A1612',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '3ch',
                textAlign: 'right',
              }}
            >
              {displayProgress}
            </motion.span>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 14,
                color: '#6B645C',
              }}
            >
              /100
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
