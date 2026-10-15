'use client';

import { motion, useReducedMotion } from 'framer-motion';

const SIZES = {
  sm: { circle: 'h-10 w-10', text: 'text-lg' },
  md: { circle: 'h-16 w-16', text: 'text-3xl' },
  lg: { circle: 'h-24 w-24', text: 'text-5xl' },
} as const;

export default function AnimatedLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const motionReduced = useReducedMotion();
  const dimensions = SIZES[size];

  return (
    <div className="flex flex-col items-center gap-2" aria-label="Me AI">
      <motion.div
        className={`${dimensions.circle} relative flex items-center justify-center overflow-hidden rounded-[24%] p-[2px] shadow-lg`}
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
          className="absolute inset-0 rounded-[24%]"
          style={{ background: 'conic-gradient(from 0deg, #FCD34D, #F59E0B, #10B981, #FCD34D)' }}
          animate={motionReduced ? undefined : { rotate: 360 }}
          transition={{ duration: 8, repeat: motionReduced ? 0 : Infinity, ease: 'linear' }}
        />
        <span className="absolute inset-[3px] rounded-[20%] bg-white" />
        <img src="/brand/me-ai-promo.webp" alt="Me AI logo" className="absolute inset-[4px] z-10 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[18%] object-contain" />
      </motion.div>
      <div className={`flex items-baseline gap-1 font-black leading-none ${dimensions.text}`}>
        <span className="text-emerald-700">Me</span>
        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">AI</span>
      </div>
    </div>
  );
}
