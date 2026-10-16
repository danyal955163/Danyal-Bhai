'use client';

import { ArrowLeft, Menu } from 'lucide-react';
import Logo from '@/components/Brand/Logo';
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
  onOpenHistory,
  onDeleteMessage,
}: {
  messages: Message[];
  onSend: (text: string, image?: File) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
  onBackToVoice: () => void;
  onOpenHistory: () => void;
  onDeleteMessage: (index: number) => void;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-50 to-white">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-2 shadow-sm sm:px-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onOpenHistory} aria-label="Open chat history" className="rounded-full p-2 text-gray-700 hover:bg-gray-100"><Menu size={21} /></button>
          <div className="flex items-center gap-2"><Logo size="sm" /><span className="text-lg font-bold text-gray-800">Me AI</span></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSelector current={currentLanguage} onChange={onLanguageChange} />
          <button type="button" onClick={onBackToVoice} aria-label="Switch to voice mode" title="Voice mode" className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50"><ArrowLeft size={20} /></button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ChatInterface messages={messages} onSend={onSend} onVoiceInput={onVoiceInput} onDeleteMessage={onDeleteMessage} isListening={isListening} isLoading={isLoading} language={currentLanguage} />
      </main>
    </div>
  );
}
