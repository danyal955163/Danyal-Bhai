'use client';

import { ArrowLeft, LogOut, Volume2, VolumeX } from 'lucide-react';
import Avatar from '@/components/Avatar/Avatar';
import CharacterSelector from '@/components/Chat/CharacterSelector';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';
import TextTicker from '@/components/Chat/TextTicker';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string };

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
  voiceEnabled,
  onToggleVoice,
  onSwitchToText,
  onBack,
  onLogout,
  onTickerTap,
}: {
  messages: Message[];
  onSend: (text: string, image?: File) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  photoUrl: string;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
  character: string;
  onCharacterChange: (id: string) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onSwitchToText: () => void;
  onBack: () => void;
  onLogout: () => void;
  onTickerTap: () => void;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between bg-white/90 px-2 shadow-sm backdrop-blur sm:px-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onBack} aria-label="Back to welcome" className="rounded-full p-2 text-gray-600 hover:bg-gray-100"><ArrowLeft size={20} /></button>
          <h1 className="text-base font-bold text-gray-800 sm:text-lg">Me AI</h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <CharacterSelector current={character} onChange={onCharacterChange} />
          <LanguageSelector current={currentLanguage} onChange={onLanguageChange} />
          <button type="button" onClick={onToggleVoice} aria-label={voiceEnabled ? 'Turn voice off' : 'Turn voice on'} className="rounded-full bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100">
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button type="button" onClick={onLogout} aria-label="Sign out" className="rounded-full p-2 text-red-500 hover:bg-red-50"><LogOut size={17} /></button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-[42vh] min-h-[340px] max-h-[400px] shrink-0 items-center justify-center overflow-hidden px-2 py-1">
          <Avatar photoUrl={photoUrl} isSpeaking={isSpeaking} isListening={isListening} />
        </section>
        <TextTicker messages={messages} onTap={onTickerTap} />
        <section className="min-h-0 flex-1 overflow-hidden border-t border-white/60 bg-white/40">
          <ChatInterface messages={messages} onSend={onSend} onVoiceInput={onVoiceInput} isListening={isListening} isLoading={isLoading} />
        </section>
        <footer className="flex h-10 shrink-0 items-center justify-center border-t border-white/60 bg-white/80">
          <button type="button" onClick={onSwitchToText} className="rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Switch to text mode</button>
        </footer>
      </main>
    </div>
  );
}
