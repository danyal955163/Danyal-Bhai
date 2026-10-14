'use client';

import { ArrowLeft, LogOut } from 'lucide-react';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string };

export default function TextMode({
  messages,
  onSend,
  onVoiceInput,
  isListening,
  isLoading,
  currentLanguage,
  onLanguageChange,
  onBackToVoice,
  onLogout,
}: {
  messages: Message[];
  onSend: (text: string, image?: File) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
  onBackToVoice: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-50 to-white">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-2 shadow-sm sm:px-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onBackToVoice} aria-label="Back to voice mode" className="rounded-full p-2 text-gray-600 hover:bg-gray-100"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold text-gray-800">Me AI</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector current={currentLanguage} onChange={onLanguageChange} />
          <button type="button" onClick={onLogout} aria-label="Sign out" className="rounded-full p-2 text-red-500 hover:bg-red-50"><LogOut size={17} /></button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ChatInterface messages={messages} onSend={onSend} onVoiceInput={onVoiceInput} isListening={isListening} isLoading={isLoading} />
      </main>
    </div>
  );
}
