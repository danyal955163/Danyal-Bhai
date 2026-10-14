'use client';

import { Keyboard, MessageCircle } from 'lucide-react';

export default function WelcomeScreen({
  onVoiceMode,
  onTextMode,
}: {
  onVoiceMode: () => void;
  onTextMode: () => void;
}) {
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-sky-100 via-white to-emerald-50 px-6 py-10 text-center">
      <div className="animate-welcome-pop mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-6xl font-bold text-white shadow-2xl">
        M
      </div>
      <h1 className="animate-welcome-rise text-3xl font-bold text-transparent [background:linear-gradient(to_right,#059669,#0f766e)] bg-clip-text">
        Me AI
      </h1>
      <p className="animate-welcome-rise mt-3 max-w-sm text-center text-gray-600 [animation-delay:100ms]">
        Aap ka apna AI dost — baat karein ya likhein
      </p>

      <div className="animate-welcome-rise mt-10 w-full max-w-sm space-y-4 [animation-delay:200ms]">
        <button
          type="button"
          onClick={onVoiceMode}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-5 text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
        >
          <MessageCircle size={24} />
          <span className="text-left">
            <span className="block text-lg font-bold">Baat Karein</span>
            <span className="block text-xs opacity-90">Voice mode — auto start</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onTextMode}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-emerald-500 bg-white py-5 text-emerald-700 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Keyboard size={24} />
          <span className="text-left">
            <span className="block text-lg font-bold">Likhein</span>
            <span className="block text-xs opacity-70">Text mode — chat style</span>
          </span>
        </button>
      </div>

      <p className="mt-10 text-xs text-gray-400">Powered by Me AI</p>
    </main>
  );
}
