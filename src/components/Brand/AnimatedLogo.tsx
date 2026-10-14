'use client';

import { motion, useReducedMotion } from 'framer-motion';

const SIZES = {
  sm: { circle: 'h-10 w-10', letter: 'text-lg', text: 'text-lg' },
  md: { circle: 'h-16 w-16', letter: 'text-2xl', text: 'text-3xl' },
  lg: { circle: 'h-24 w-24', letter: 'text-4xl', text: 'text-5xl' },
} as const;

export default function AnimatedLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const motionReduced = useReducedMotion();
  const dimensions = SIZES[size];

  return (
    <div className="flex flex-col items-center gap-2" aria-label="Me AI">
      <motion.div
        className={`${dimensions.circle} relative flex items-center justify-center overflow-hidden rounded-full p-[2px] shadow-lg`}
        animate={motionReduced ? undefined : {
          y: [0, -3, 0],
          scale: [1, 1.025, 1],
          boxShadow: [
            '0 0 18px rgba(251, 191, 36, 0.42), 0 0 34px rgba(16, 185, 129, 0.2)',
            '0 0 30px rgba(251, 191, 36, 0.76), 0 0 56px rgba(16, 185, 129, 0.34)',
            '0 0 18px rgba(251, 191, 36, 0.42), 0 0 34px rgba(16, 185, 129, 0.2)',
          ],
        }}
        transition={{ duration: 3.2, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, #FCD34D, #F59E0B, #10B981, #FCD34D)' }}
          animate={motionReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 8, repeat: motionReduced ? 0 : Infinity, ease: 'linear' }}
        />
        <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600" />
        <span className={`relative z-10 font-black text-white drop-shadow-lg ${dimensions.letter}`}>M</span>
        {!motionReduced && <motion.span
          aria-hidden="true"
          className="absolute left-[22%] top-[18%] z-20 h-[18%] w-[18%] rounded-full bg-white/80 blur-[1px]"
          animate={{ opacity: [0.45, 0.95, 0.45], scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />}
      </motion.div>
      <div className={`flex items-baseline gap-1 font-black leading-none ${dimensions.text}`}>
        <span className="text-emerald-700">Me</span>
        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">AI</span>
      </div>
    </div>
  );
}
