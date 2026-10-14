'use client';

import { Keyboard, Menu, X } from 'lucide-react';
import Avatar from '@/components/Avatar/Avatar';
import Logo from '@/components/Brand/Logo';
import CharacterSelector from '@/components/Chat/CharacterSelector';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';
import TextTicker from '@/components/Chat/TextTicker';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; imageUrls?: string[] };

export default function VoiceMode({
  messages,
  onSend,
  onVoiceInput,
  isListening,
  isLoading,
  isSpeaking,
  photoUrl,
  currentLanguage,
  onLanguageChange,
  character,
  onCharacterChange,
  onSwitchToText,
  onBack,
  onOpenHistory,
  onLogout,
  onTickerTap,
}: {
  messages: Message[];
  onSend: (text: string, images?: File[]) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  photoUrl: string;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
  character: string;
  onCharacterChange: (id: string) => void;
  onSwitchToText: () => void;
  onBack: () => void;
  onOpenHistory: () => void;
  onLogout: () => void;
  onTickerTap: () => void;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-white">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between bg-white/90 px-2 shadow-sm backdrop-blur sm:px-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onOpenHistory} aria-label="Open chat history" className="rounded-full p-2 text-gray-700 hover:bg-gray-100"><Menu size={21} /></button>
          <Logo size="sm" />
          <span className="text-base font-bold text-gray-800 sm:text-lg">Me AI</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <CharacterSelector current={character} onChange={onCharacterChange} />
          <LanguageSelector current={currentLanguage} onChange={onLanguageChange} />
          <button type="button" onClick={onLogout} aria-label="Sign out" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">Sign out</button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-[55vh] min-h-[300px] max-h-[520px] shrink-0 items-center justify-center overflow-hidden px-2 py-1">
          <Avatar photoUrl={photoUrl} isSpeaking={isSpeaking} isListening={isListening} />
        </section>
        <TextTicker messages={messages} onTap={onTickerTap} />
        <section className="min-h-0 flex-1 overflow-hidden border-t border-white/60 bg-white/40">
          <ChatInterface messages={messages} onSend={onSend} onVoiceInput={onVoiceInput} isListening={isListening} isLoading={isLoading} language={currentLanguage} />
        </section>
        <footer className="flex h-12 shrink-0 items-center justify-center gap-3 border-t border-white/60 bg-white/90 px-3">
          <button type="button" onClick={onSwitchToText} className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"><Keyboard size={15} />Text mode</button>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"><X size={15} />Close</button>
        </footer>
      </main>
    </div>
  );
}
