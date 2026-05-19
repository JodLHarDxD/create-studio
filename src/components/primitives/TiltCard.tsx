import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useScroll, useTransform } from 'motion/react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  parallax?: boolean;
}

/**
 * 3D hover tilt + optional scroll-linked parallax wrapper.
 * Drop content inside; use children with translateZ(20px) for layered depth.
 */
export default function TiltCard({
  children,
  className = '',
  isActive = false,
  onClick,
  parallax = false,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 150, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = card.getBoundingClientRect();
    const xPos = clientX - left;
    const yPos = clientY - top;
    const rY = ((xPos / width) - 0.5) * 12;
    const rX = (((yPos / height) - 0.5) * -12);
    rotateX.set(rX);
    rotateY.set(rY);
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  // Scroll parallax (only if requested)
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'end start'],
  });
  const smoothParallax = useSpring(scrollYProgress, { stiffness: 60, damping: 20, mass: 0.5 });
  const parallaxY = useTransform(smoothParallax, [0, 1], ['-20%', '20%']);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ rotateX: springRotateX, rotateY: springRotateY, transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative ${onClick ? 'cursor-pointer' : ''} block border w-full text-left transition-colors duration-500 ${
        isActive
          ? 'border-emerald-500/40 bg-zinc-900/60'
          : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/30'
      } backdrop-blur-md ${className}`}
      data-parallax={parallax}
      data-parallax-y={parallax ? parallaxY : undefined}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-white/[0.02] to-transparent" />
      {children}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out" />
    </motion.div>
  );
}
