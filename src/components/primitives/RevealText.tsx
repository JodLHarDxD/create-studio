import { motion } from 'motion/react';

interface RevealTextProps {
  text: string;
  className?: string;
  delay?: number;
  once?: boolean;
}

/**
 * Word-by-word vertical reveal. Each word slides up from below its
 * own overflow mask, staggered. Cinematic editorial entrance.
 */
export default function RevealText({
  text,
  className = '',
  delay = 0,
  once = true,
}: RevealTextProps) {
  const words = text.split(' ');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: delay },
    },
  };

  const wordVariants = {
    hidden: { y: '110%', opacity: 0 },
    visible: {
      y: '0%',
      opacity: 1,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <motion.span
      className={`inline-block overflow-hidden vertical-align-bottom py-1 ${className}`}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-50px' }}
    >
      {words.map((word, idx) => (
        <span key={`${word}-${idx}`} className="inline-block overflow-hidden mr-[0.25em] whitespace-nowrap">
          <motion.span variants={wordVariants} className="inline-block">
            {word}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
