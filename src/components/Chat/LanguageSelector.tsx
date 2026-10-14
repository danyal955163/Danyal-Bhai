'use client';

import { Globe } from 'lucide-react';
import { useState } from 'react';
import { LANGUAGES } from '@/lib/languages';

export default function LanguageSelector({
  current,
  onChange,
}: {
  current: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLanguage = LANGUAGES.find((language) => language.code === current) ?? LANGUAGES[0];

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Choose language"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700"
      >
        <Globe size={14} />
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close language menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            {LANGUAGES.map((language) => (
              <button
                type="button"
                key={language.code}
                onClick={() => { onChange(language.code); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${current === language.code ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-gray-700'}`}
              >
                <span>{language.flag}</span>
                <span>{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
