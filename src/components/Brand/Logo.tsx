'use client';

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-base',
  md: 'h-12 w-12 text-xl',
  lg: 'h-24 w-24 text-4xl',
};

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      aria-label="Me AI logo"
      className={`brand-logo relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 font-black text-white shadow-xl ${SIZE_CLASSES[size]}`}
    >
      <span className="relative z-10 drop-shadow-md">M</span>
      <span aria-hidden="true" className="brand-logo-shine absolute left-[22%] top-[18%] h-[18%] w-[18%] rounded-full bg-white/70 blur-[1px]" />
      <span aria-hidden="true" className="logo-ai-label absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] font-black tracking-[0.2em] text-emerald-700">AI</span>
    </div>
  );
}
