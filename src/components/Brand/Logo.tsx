'use client';

const SIZE_CLASSES = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-24 w-24',
};

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      aria-label="Me AI logo"
      className={`brand-logo relative shrink-0 overflow-hidden rounded-[24%] border-2 border-amber-300 bg-white shadow-xl ${SIZE_CLASSES[size]}`}
    >
      <img src="/brand/me-ai-promo.webp" alt="Me AI logo" className="h-full w-full object-contain" />
    </div>
  );
}
