'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Image as ImageIcon, Keyboard, LogOut, Menu, Mic, Settings, Volume2, VolumeX } from 'lucide-react';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import CharacterSelector from '@/components/Chat/CharacterSelector';

interface VoiceDashboardProps {
  photoUrl: string;
  isSpeaking: boolean;
  isListening: boolean;
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
}

export default function VoiceDashboard({
  photoUrl,
  isSpeaking,
  isListening,
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
}: VoiceDashboardProps) {
  const [blink, setBlink] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const motionReduced = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 4_200);
    return () => window.clearInterval(timer);
  }, []);

  const activityColor = isSpeaking ? 'bg-emerald-500' : isListening ? 'bg-rose-500' : isLoading ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-slate-800">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" animate={motionReduced ? undefined : { x: [0, 36, 0], y: [0, -26, 0], scale: [1, 1.13, 1] }} transition={{ duration: 12, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -right-24 bottom-16 h-96 w-96 rounded-full bg-amber-300/25 blur-3xl" animate={motionReduced ? undefined : { x: [0, -30, 0], y: [0, 34, 0], scale: [1, 1.08, 1] }} transition={{ duration: 15, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut', delay: 1 }} />
        <motion.div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300/20 blur-3xl" animate={motionReduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.36, 0.66, 0.36] }} transition={{ duration: 10, repeat: motionReduced ? 0 : Infinity }} />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-4 sm:px-7">
        <button type="button" onClick={onOpenHistory} aria-label="Open chat history" className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white">
          <Menu size={19} />
        </button>
        <AnimatedLogo size="sm" />
        <div className="flex items-center gap-1.5">
          <CharacterSelector current={character} onChange={onCharacterChange} />
          <button type="button" onClick={onToggleVoice} aria-label={voiceEnabled ? 'Turn voice off' : 'Turn voice on'} title={voiceEnabled ? 'Turn voice off' : 'Turn voice on'} className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white">
            {voiceEnabled ? <Volume2 size={18} className="text-emerald-700" /> : <VolumeX size={18} className="text-slate-500" />}
          </button>
          <button type="button" onClick={onSettings} aria-label="Settings" className="rounded-full bg-white/70 p-2.5 shadow-sm backdrop-blur transition hover:bg-white"><Settings size={18} /></button>
          <button type="button" onClick={onLogout} aria-label="Sign out" className="rounded-full bg-white/70 p-2.5 text-slate-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-rose-600"><LogOut size={18} /></button>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-2">
        <div className="relative flex items-center justify-center">
          {(isListening || isSpeaking) && <motion.div aria-hidden="true" className={`absolute inset-0 rounded-full ${isSpeaking ? 'bg-emerald-400/25' : 'bg-rose-400/20'}`} animate={{ scale: [1, 1.38, 1.62], opacity: [0.5, 0.2, 0] }} transition={{ duration: isSpeaking ? 1.35 : 1.7, repeat: motionReduced ? 0 : Infinity, ease: 'easeOut' }} />}
          {isListening && <motion.div aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-rose-400/70" animate={{ scale: [1, 1.5], opacity: [0.65, 0] }} transition={{ duration: 1.5, repeat: motionReduced ? 0 : Infinity, ease: 'easeOut' }} />}
          <motion.div
            className={`relative h-56 w-56 overflow-hidden rounded-full border-[5px] border-white bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_22px_70px_rgba(15,118,110,0.22)] sm:h-72 sm:w-72 ${isSpeaking ? 'ring-8 ring-emerald-300/45' : isListening ? 'ring-8 ring-rose-300/40' : 'ring-4 ring-white/50'}`}
            animate={motionReduced ? undefined : isSpeaking
              ? { scale: [1, 1.035, 1.015, 1.04, 1], rotate: [0, -1, 1, -0.7, 0], y: [0, -5, -2, -5, 0] }
              : isListening ? { scale: [1, 1.035, 1] } : { scale: [1, 1.012, 1] }}
            transition={{ duration: isSpeaking ? 0.95 : isListening ? 1.55 : 3.8, repeat: motionReduced ? 0 : Infinity, ease: 'easeInOut' }}
          >
            {avatarFailed ? (
              <div className="flex h-full w-full items-center justify-center text-7xl font-black text-white">M</div>
            ) : (
              <img src={photoUrl} alt="Me AI assistant" onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" style={{ transform: blink ? 'scaleY(0.98)' : 'scaleY(1)', transition: 'transform 140ms' }} />
            )}
            {isSpeaking && <motion.div aria-hidden="true" className="absolute bottom-12 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-rose-400/55 blur-md" animate={{ scaleX: [0.9, 1.35, 0.9], opacity: [0.45, 0.9, 0.45] }} transition={{ duration: 0.2, repeat: motionReduced ? 0 : Infinity }} />}
          </motion.div>
          {(isSpeaking || isListening) && <div aria-hidden="true" className="absolute -bottom-9 left-1/2 flex h-7 -translate-x-1/2 items-end gap-1">
            {[0.55, 0.85, 1, 0.7, 0.95].map((height, index) => <motion.span key={index} className={`w-1.5 rounded-full ${isSpeaking ? 'bg-emerald-500' : 'bg-rose-500'}`} animate={motionReduced ? undefined : { height: [`${height * 28}%`, `${height * 100}%`, `${height * 28}%`] }} transition={{ duration: 0.48 + index * 0.09, repeat: motionReduced ? 0 : Infinity, delay: index * 0.08 }} />)}
          </div>}
        </div>

        <div className="mt-14 flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 shadow-sm backdrop-blur" role="status" aria-live="polite">
          <span className={`h-2.5 w-2.5 rounded-full ${activityColor} ${isListening || isSpeaking || isLoading ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-semibold text-slate-700">{statusText}</span>
        </div>
        <p className="mt-3 text-center text-sm font-medium text-slate-500">Talk by voice, or switch to text chat below.</p>

      </section>

      <footer className="relative z-10 flex flex-wrap items-center justify-center gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={onVoiceInput} disabled={isSpeaking || isLoading} aria-label={isSpeaking ? 'Listening for interruption' : isListening ? 'Stop listening' : 'Tap to talk'} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:cursor-default disabled:opacity-75 ${isListening ? 'bg-rose-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
          <Mic size={18} />{isSpeaking ? 'Listening for interruption' : isListening ? 'Listening' : isLoading ? 'Please wait' : 'Tap to talk'}
        </button>
        <button type="button" onClick={onImageMode} disabled={isLoading} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white disabled:opacity-50"><ImageIcon size={18} />Image</button>
        <button type="button" onClick={onTextMode} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"><Keyboard size={17} />Text chat</button>
      </footer>
    </main>
  );
}
