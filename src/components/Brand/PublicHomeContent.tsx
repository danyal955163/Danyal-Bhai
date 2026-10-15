'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import { loadPreferences } from '@/lib/preferences';

export default function PublicHomeContent() {
  const [language, setLanguage] = useState('en-US');
  useEffect(() => setLanguage(loadPreferences().uiLanguage), []);
  const copy = language === 'ur-PK'
    ? { tagline: 'آپ کا کثیر لسانی وائس اسسٹنٹ', description: 'اکاؤنٹ بنائیں اور AI سے بات چیت شروع کریں', signup: 'سائن اپ', login: 'لاگ اِن', copyright: '© 2026 Me AI' }
    : language === 'ps-AF'
      ? { tagline: 'ستاسو څوژبی غږیز مرستیال', description: 'حساب جوړ کړئ او له AI سره خبرې پیل کړئ', signup: 'حساب جوړ کړئ', login: 'ننوتل', copyright: '© 2026 Me AI' }
      : { tagline: 'Your multilingual voice assistant', description: 'Sign up and start chatting with AI', signup: 'Sign Up', login: 'Login', copyright: '© 2026 Me AI' };
  const rtl = language === 'ur-PK' || language === 'ps-AF';

  return (
    <main lang={language} dir={rtl ? 'rtl' : 'ltr'} className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl md:p-12">
        <div className="mx-auto flex justify-center"><AnimatedLogo size="lg" /></div>
        <p className="mb-4 mt-4 text-xl font-medium text-emerald-600 md:text-2xl">{copy.tagline}</p>
        <p className="mb-8 text-base leading-relaxed text-gray-500">{copy.description}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row"><Link href="/signup" className="rounded-xl bg-emerald-500 px-8 py-3 font-semibold text-white transition-colors hover:bg-emerald-600">{copy.signup}</Link><Link href="/login" className="rounded-xl border-2 border-emerald-500 px-8 py-3 font-semibold text-emerald-600 transition-colors hover:bg-emerald-50">{copy.login}</Link></div>
      </div>
      <footer className="mt-8 text-sm text-white/80">{copy.copyright}</footer>
    </main>
  );
}
