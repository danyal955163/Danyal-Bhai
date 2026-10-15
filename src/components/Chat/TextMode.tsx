'use client';

import { ArrowLeft, Menu } from 'lucide-react';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; imageUrls?: string[] };

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
  autoOpenImagePicker,
  onImagePickerHandled,
}: {
  messages: Message[];
  onSend: (text: string, images?: File[]) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  currentLanguage: string;
  onLanguageChange: (code: string) => void;
  onBackToVoice: () => void;
  onOpenHistory: () => void;
  autoOpenImagePicker?: boolean;
  onImagePickerHandled?: () => void;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-50 to-white">
      <header className="z-20 flex h-[4.5rem] shrink-0 items-center justify-between border-b border-gray-100 bg-white/95 px-2 shadow-sm backdrop-blur sm:px-4">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onOpenHistory} aria-label="Open chat history" className="rounded-full p-2 text-gray-700 hover:bg-gray-100"><Menu size={21} /></button>
          <AnimatedLogo size="sm" />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSelector current={currentLanguage} onChange={onLanguageChange} />
          <button type="button" onClick={onBackToVoice} aria-label="Switch to voice mode" title="Voice mode" className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50"><ArrowLeft size={20} /></button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ChatInterface messages={messages} onSend={onSend} onVoiceInput={onVoiceInput} isListening={isListening} isLoading={isLoading} language={currentLanguage} autoOpenImagePicker={autoOpenImagePicker} onImagePickerHandled={onImagePickerHandled} />
      </main>
    </div>
  );
}
