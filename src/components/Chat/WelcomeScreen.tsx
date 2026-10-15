'use client';

import { Keyboard, Menu, MessageCircle, Settings2, Sparkles } from 'lucide-react';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';

const COPY: Record<string, { tagline: string; voice: string; voiceHint: string; text: string; textHint: string; footer: string }> = {
  'ur-PK': {
    tagline: 'آپ کا اپنا AI ساتھی — بات کریں یا لکھیں',
    voice: 'بات کریں',
    voiceHint: 'آواز کے ذریعے گفتگو',
    text: 'لکھ کر بات کریں',
    textHint: 'تحریری چیٹ',
    footer: 'اردو، English اور پښتو میں آپ کے ساتھ',
  },
  'ps-AF': {
    tagline: 'ستاسو خپل AI ملګری — خبرې وکړئ یا ولیکئ',
    voice: 'خبرې وکړئ',
    voiceHint: 'د غږ له لارې خبرې',
    text: 'ولیكئ',
    textHint: 'لیکلې خبرې اترې',
    footer: 'په پښتو، اردو او English کې ستاسو ملګری',
  },
  'en-US': {
    tagline: 'Your own AI companion — talk or type',
    voice: 'Talk',
    voiceHint: 'Speak naturally with Me AI',
    text: 'Type',
    textHint: 'Chat by text',
    footer: 'Here with you in Urdu, English, and Pashto',
  },
};

export default function WelcomeScreen({
  onVoiceMode,
  onTextMode,
  onOpenHistory,
  onSettings,
  language,
}: {
  onVoiceMode: () => void;
  onTextMode: () => void;
  onOpenHistory: () => void;
  onSettings: () => void;
  language: string;
}) {
  const isRtl = language === 'ur-PK' || language === 'ps-AF';
  const copy = COPY[language] ?? COPY['ur-PK'];

  return (
    <main lang={language} dir={isRtl ? 'rtl' : 'ltr'} className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#fffaf0] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-slate-800 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,rgba(255,220,107,0.48),transparent_48%),linear-gradient(155deg,#f5fbff_0%,#fffdf6_47%,#eafaf4_100%)]" />
        <div className="home-orb home-orb-one absolute -left-20 top-28 h-64 w-64 rounded-full bg-amber-300/40 blur-3xl" />
        <div className="home-orb home-orb-two absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="home-grid absolute inset-0 opacity-30" />
      </div>

      <header className="relative z-10 flex items-center justify-between">
        <button type="button" onClick={onOpenHistory} aria-label="Chat history" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
          <Menu size={21} />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/70 px-3 py-2 text-xs font-bold text-amber-900 shadow-sm backdrop-blur">
          <Sparkles size={14} className="text-amber-500" />
          <span>ME AI</span>
        </div>
        <button type="button" onClick={onSettings} aria-label="Settings" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md">
          <Settings2 size={21} />
        </button>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center py-8 text-center">
        <div className="relative mb-8 flex items-center justify-center">
          <div aria-hidden="true" className="home-logo-orbit absolute h-36 w-36 rounded-full border border-amber-300/70 sm:h-40 sm:w-40" />
          <div aria-hidden="true" className="absolute h-44 w-44 rounded-full bg-amber-300/20 blur-2xl sm:h-48 sm:w-48" />
          <div className="relative rounded-[2rem] border border-white/80 bg-white/65 p-4 shadow-[0_22px_65px_rgba(184,130,24,0.16)] backdrop-blur-sm">
            <AnimatedLogo size="lg" />
          </div>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/75 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" />
          <span>{language === 'en-US' ? 'Ready when you are' : language === 'ps-AF' ? 'کله چې چمتو یاست' : 'آپ کی بات سننے کے لیے تیار'}</span>
        </div>

        <h1 className="max-w-md text-balance text-lg font-semibold leading-relaxed text-slate-700 sm:text-xl">{copy.tagline}</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {language === 'en-US' ? 'Ask anything, or use your phone camera to take a photo or record a video.' : language === 'ps-AF' ? 'هره پوښتنه وکړئ، یا د موبایل په کامره عکس او ویډیو واخلئ.' : 'اپنا سوال پوچھیں، یا موبائل کیمرے سے تصویر لیں اور ویڈیو بنائیں۔'}
        </p>

        <div className="mt-8 w-full space-y-3.5">
          <button type="button" onClick={onVoiceMode} className="group flex min-h-[78px] w-full items-center gap-4 rounded-[1.4rem] border border-emerald-400/50 bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-600 px-5 py-4 text-white shadow-[0_16px_36px_rgba(13,148,106,0.24)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(13,148,106,0.32)] active:scale-[0.985]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 transition group-hover:bg-white/20"><MessageCircle size={23} /></span>
            <span className="flex-1 text-start">
              <span className="block text-lg font-extrabold">{copy.voice}</span>
              <span className="mt-0.5 block text-sm text-white/85">{copy.voiceHint}</span>
            </span>
            <span aria-hidden="true" className="text-amber-200">✦</span>
          </button>

          <button type="button" onClick={onTextMode} className="group flex min-h-[78px] w-full items-center gap-4 rounded-[1.4rem] border border-emerald-200 bg-white/85 px-5 py-4 text-emerald-900 shadow-[0_12px_30px_rgba(15,23,42,0.07)] backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:bg-white hover:shadow-lg active:scale-[0.985]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-amber-50 group-hover:text-amber-700"><Keyboard size={23} /></span>
            <span className="flex-1 text-start">
              <span className="block text-lg font-extrabold">{copy.text}</span>
              <span className="mt-0.5 block text-sm text-emerald-800/70">{copy.textHint}</span>
            </span>
          </button>
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-lg pb-2 text-center">
        <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
        <p className="text-xs font-medium tracking-wide text-slate-500">{copy.footer}</p>
        <p className="mt-1 text-[11px] text-slate-400">Powered by Me AI</p>
      </footer>
    </main>
  );
}
