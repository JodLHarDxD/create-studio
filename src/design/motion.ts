import type { Variants, Transition } from 'motion/react';
import { motion as motionTokens } from './tokens';

export const transitions = {
  fast: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard } as Transition,
  base: { duration: motionTokens.duration.base, ease: motionTokens.ease.standard } as Transition,
  slow: { duration: motionTokens.duration.slow, ease: motionTokens.ease.standard } as Transition,
  cinematic: { duration: motionTokens.duration.cinematic, ease: motionTokens.ease.entrance } as Transition,
  spring: motionTokens.ease.spring as Transition,
};

export const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: transitions.base },
    exit: { opacity: 0, y: -8, transition: transitions.fast },
  } satisfies Variants,

  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transitions.base },
    exit: { opacity: 0, transition: transitions.fast },
  } satisfies Variants,

  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: transitions.base },
    exit: { opacity: 0, scale: 0.98, transition: transitions.fast },
  } satisfies Variants,

  slideRight: {
    hidden: { x: -16, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: transitions.base },
    exit: { x: 16, opacity: 0, transition: transitions.fast },
  } satisfies Variants,

  cinematicReveal: {
    hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: transitions.cinematic,
    },
    exit: { opacity: 0, y: -12, filter: 'blur(8px)', transition: transitions.slow },
  } satisfies Variants,

  staggerContainer: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
  } satisfies Variants,

  staggerChild: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: transitions.fast },
  } satisfies Variants,
};
