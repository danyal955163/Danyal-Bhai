'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, Image as ImageIcon, Keyboard, LogOut, Menu, Mic, Settings, Volume2, VolumeX } from 'lucide-react';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import CharacterSelector from '@/components/Chat/CharacterSelector';

interface VoiceDashboardProps {
  photoUrl: string;
  uiLanguage: string;
  isSpeaking: boolean;
  isListening: boolean;
  micLevel: number;
  aiLevel: number;
  isLoading: boolean;
  statusText: string;
  voiceEnabled: boolean;
  character: string;
  onCharacterChange: (character: string) => void;
  onVoiceInput: () => void;
  onOpenHistory: () => void;
  onSettings: () => void;
  onTextMode: () => void;
  onToggleVoice: () => void;
  onLogout: () => void;
  onImageMode: () => void;
  onCamera: () => void;
}

export default function VoiceDashboard({
  photoUrl,
  uiLanguage,
  isSpeaking,
  isListening,
  micLevel,
  aiLevel,
  isLoading,
  statusText,
  voiceEnabled,
  character,
  onCharacterChange,
  onVoiceInput,
  onOpenHistory,
  onSettings,
  onTextMode,
  onToggleVoice,
  onLogout,
  onImageMode,
  onCamera,
}: VoiceDashboardProps) {
  const [blink, setBlink] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const motionReduced = useReducedMotion();
  const copy = {
    'ur-PK': { history: 'چیٹ ہسٹری کھولیں', voiceOff: 'آواز بند کریں', voiceOn: 'آواز چلائیں', settings: 'سیٹنگز', logout: 'لاگ آؤٹ', subtitle: 'آواز سے بات کریں، یا نیچے تحریری چیٹ کھولیں۔', interrupt: 'آپ کی بات سن رہا ہوں', listening: 'سن رہا ہوں', wait: 'انتظار کریں', talk: 'بات شروع کریں', image: 'تصویر', text: 'تحریری چیٹ', camera: 'کیمرہ', cameraHint: 'اپنے فون کے کیمرے سے AI کی مدد کے ساتھ ویڈیو بنائیں' },
    'ps-AF': { history: 'د خبرو مخینه پرانیزئ', voiceOff: 'غږ بند کړئ', voiceOn: 'غږ چالان کړئ', settings: 'امستنې', logout: 'وتل', subtitle: 'په غږ خبرې وکړئ، یا لاندې لیکلې خبرې پرانیزئ.', interrupt: 'ستاسو غږ اورم', listening: 'اورم', wait: 'لږ انتظار', talk: 'خبرې پیل کړئ', image: 'انځور', text: 'لیکلې خبرې', camera: 'کامره', cameraHint: 'د خپل موبایل په کامره د AI په مرسته ویډیو جوړه کړئ' },
    'en-US': { history: 'Open chat history', voiceOff: 'Turn voice off', voiceOn: 'Turn voice on', settings: 'Settings', logout: 'Sign out', subtitle: 'Talk by voice, or switch to text chat below.', interrupt: 'Listening for interruption', listening: 'Listening', wait: 'Please wait', talk: 'Tap to talk', image: 'Image', text: 'Text chat', camera: 'Camera', cameraHint: 'Record videos with your phone camera, with AI assistance' },
  }[uiLanguage] ?? {
    history: 'Open chat history', voiceOff: 'Turn voice off', voiceOn: 'Turn voice on', settings: 'Settings', logout: 'Sign out', subtitle: 'Talk by voice, or switch to text chat below.', interrupt: 'Listening for interruption', listening: 'Listening', wait: 'Please wait', talk: 'Tap to talk', image: 'Image', text: 'Text chat', camera: 'Camera', cameraHint: 'Record videos with your phone camera, with AI assistance',
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 4_200);
    return () => window.clearInterval(timer);
  }, []);

  const activeLevel = isSpeaking ? aiLevel : isListening ? micLevel : 0;
  const levelRatio = Math.max(0, Math.min(100, activeLevel)) / 100;
  const ringScale = 1 + levelRatio * 0.4;
  const ringOpacity = activeLevel > 2 ? 0.2 + levelRatio * 0.6 : 0;
  const activityColor = isSpeaking || micLevel > 2 ? 'bg-emerald-500' : isListening ? 'bg-teal-500' : isLoading ? 'bg-amber-500' : 'bg-teal-500';

  return (
      <main lang={uiLanguage} dir={uiLanguage === 'ur-PK' || uiLanguage === 'ps-AF' ? 'rtl' : 'ltr'} className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-slate-800">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" animate={motionReduced ? undefined : { x: [0, 36, 0], y: [0, -26, 0], scale: [1, 1.13, 1] }} transition={{ duration: 12, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -right-24 bottom-16 h-96 w-96 rounded-full bg-amber-300/25 blur-3xl" animate={motionReduced ? undefined : { x: [0, -30, 0], y: [0, 34, 0], scale: [1, 1.08, 1] }} transition={{ duration: 15, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut', delay: 1 }} />
        <motion.div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300/20 blur-3xl" animate={motionReduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.36, 0.66, 0.36] }} transition={{ duration: 10, repeat: motionReduced ? 0 : Infinity }} />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:px-7">
        <button type="button" onClick={onOpenHistory} aria-label={copy.history} className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white">
          <Menu size={19} />
        </button>
        <AnimatedLogo size="sm" />
        <div className="flex items-center gap-1.5">
          <CharacterSelector current={character} onChange={onCharacterChange} uiLanguage={uiLanguage} />
          <button type="button" onClick={onToggleVoice} aria-label={voiceEnabled ? copy.voiceOff : copy.voiceOn} title={voiceEnabled ? copy.voiceOff : copy.voiceOn} className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white">
            {voiceEnabled ? <Volume2 size={18} className="text-emerald-700" /> : <VolumeX size={18} className="text-slate-500" />}
          </button>
          <button type="button" onClick={onSettings} aria-label={copy.settings} className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white"><Settings size={18} /></button>
          <button type="button" onClick={onLogout} aria-label={copy.logout} className="rounded-full bg-white/70 p-2.5 text-slate-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-rose-600"><LogOut size={18} /></button>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-2">
        <div className="relative flex items-center justify-center">
          {(isListening || isSpeaking) && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/25" animate={{ scale: ringScale, opacity: ringOpacity }} transition={{ duration: 0.12, ease: 'easeOut' }} />}
          {(isListening || isSpeaking) && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400/70" animate={{ scale: ringScale, opacity: ringOpacity }} transition={{ duration: 0.1, ease: 'easeOut' }} />}
          <motion.div
            className={`relative h-56 w-56 overflow-hidden rounded-full border-[5px] border-white bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_22px_70px_rgba(15,118,110,0.22)] sm:h-72 sm:w-72 ${activeLevel > 2 ? 'ring-8 ring-emerald-300/45' : 'ring-4 ring-white/50'}`}
            animate={motionReduced ? undefined : { scale: 1 + levelRatio * 0.045, rotate: isSpeaking ? levelRatio * 0.8 : 0, y: isSpeaking ? -levelRatio * 4 : 0 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
          >
            {avatarFailed ? (
              <div className="flex h-full w-full items-center justify-center text-7xl font-black text-white">M</div>
            ) : (
              <img src={photoUrl} alt="Me AI assistant" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" style={{ transform: blink ? 'scaleY(0.98)' : 'scaleY(1)', transition: 'transform 140ms' }} />
            )}
            {isSpeaking && <motion.div aria-hidden="true" className="absolute bottom-12 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-emerald-400/60 blur-md" animate={{ scaleX: 0.6 + levelRatio * 0.9, opacity: 0.15 + levelRatio * 0.75 }} transition={{ duration: 0.08, ease: 'easeOut' }} />}
          </motion.div>
          {(isSpeaking || isListening) && <div aria-hidden="true" className="absolute -bottom-9 left-1/2 flex h-7 -translate-x-1/2 items-end gap-1">
            {[0.4, 0.7, 1, 0.7, 0.4].map((weight, index) => <motion.span key={index} className="w-1.5 rounded-full bg-emerald-500" animate={{ height: `${Math.max(15, activeLevel * weight)}%` }} transition={{ duration: 0.1, ease: 'easeOut' }} />)}
          </div>}
        </div>

        <div className="mt-14 flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-sm backdrop-blur" role="status" aria-live="polite">
          <span className={`h-2.5 w-2.5 rounded-full ${activityColor} ${activeLevel > 2 ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold text-slate-700">{statusText}</span>
        </div>
        <p className="mt-3 text-center text-sm font-medium text-slate-500">{copy.subtitle}</p>

      </section>

      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={onVoiceInput} disabled={isSpeaking || isLoading} aria-label={isSpeaking ? copy.interrupt : isListening ? copy.listening : copy.talk} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:cursor-default disabled:opacity-75 ${isListening ? 'bg-rose-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
          <Mic size={18} />{isSpeaking ? copy.interrupt : isListening ? copy.listening : isLoading ? copy.wait : copy.talk}
        </button>
        <button type="button" onClick={onImageMode} disabled={isLoading} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white disabled:opacity-50"><ImageIcon size={18} />{copy.image}</button>
        <button type="button" onClick={onTextMode} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"><Keyboard size={17} />{copy.text}</button>
        <button type="button" onClick={onCamera} className="group flex min-h-14 w-full max-w-sm items-center justify-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-emerald-50 px-4 py-3 text-start shadow-md transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm transition group-hover:rotate-3"><Camera size={22} /></span>
          <span><span className="block text-sm font-extrabold text-slate-800">{copy.camera}</span><span className="mt-0.5 block text-xs leading-4 text-slate-500">{copy.cameraHint}</span></span>
        </button>
      </footer>
    </main>
  );
}
