'use client';

import { Keyboard, Menu, MessageCircle } from 'lucide-react';
import Logo from '@/components/Brand/Logo';

export default function WelcomeScreen({
  onVoiceMode,
  onTextMode,
  onOpenHistory,
}: {
  onVoiceMode: () => void;
  onTextMode: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <main className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-white to-emerald-50 px-6 py-10 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="welcome-orb welcome-orb-one absolute -left-12 top-16 h-44 w-44 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="welcome-orb welcome-orb-two absolute -right-12 bottom-16 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="welcome-orb welcome-orb-three absolute left-[55%] top-[38%] h-28 w-28 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="welcome-dots absolute inset-0 opacity-30" />
      </div>
      <button type="button" onClick={onOpenHistory} aria-label="Open chat history" className="absolute left-3 top-3 z-10 rounded-full bg-white/80 p-3 text-gray-700 shadow-sm hover:bg-white">
        <Menu size={22} />
      </button>
      <div className="animate-welcome-pop relative z-10 mb-6"><Logo size="lg" /></div>
      <h1 className="animate-welcome-rise relative z-10 text-3xl font-bold text-transparent [background:linear-gradient(to_right,#059669,#0f766e)] bg-clip-text">Me AI</h1>
      <p className="animate-welcome-rise relative z-10 mt-3 max-w-sm text-center text-gray-600 [animation-delay:100ms]">Aap ka apna AI dost — baat karein ya likhein</p>

      <div className="animate-welcome-rise relative z-10 mt-10 w-full max-w-sm space-y-4 [animation-delay:200ms]">
        <button type="button" onClick={onVoiceMode} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-5 text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95">
          <MessageCircle size={24} />
          <span className="text-left"><span className="block text-lg font-bold">Baat Karein</span><span className="block text-xs opacity-90">Voice mode — auto start</span></span>
        </button>
        <button type="button" onClick={onTextMode} className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-emerald-500 bg-white py-5 text-emerald-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95">
          <Keyboard size={24} />
          <span className="text-left"><span className="block text-lg font-bold">Likhein</span><span className="block text-xs opacity-70">Text mode — chat style</span></span>
        </button>
      </div>
      <p className="relative z-10 mt-10 text-xs text-gray-400">Powered by Me AI</p>
    </main>
  );
}
