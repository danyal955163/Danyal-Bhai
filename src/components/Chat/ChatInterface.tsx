'use client';

import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; imageUrls?: string[] };

export default function ChatInterface({
  messages,
  onSend,
  onVoiceInput,
  isListening,
  isLoading,
  language,
  uiLanguage = language,
  autoOpenImagePicker,
  onImagePickerHandled,
}: {
  messages: Message[];
  onSend: (text: string, images?: File[]) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
  language: string;
  uiLanguage?: string;
  autoOpenImagePicker?: boolean;
  onImagePickerHandled?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const copy = uiLanguage === 'ps-AF'
    ? 'د لیکلو یا خبرو له لارې نوې خبرې پیل کړئ'
    : uiLanguage === 'en-US'
      ? 'Start a conversation by typing or speaking'
      : 'لکھ کر یا بول کر گفتگو شروع کریں';

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div id="chat-conversation" aria-label="Chat messages" className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">
            {copy}
          </div>
        )}
        {messages.map((message, index) => (
          <ChatBubble key={`${message.role}-${index}`} {...message} uiLanguage={uiLanguage} />
        ))}
        {isLoading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:100ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:200ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <ChatInput
        onSend={onSend}
        onVoiceInput={onVoiceInput}
        isListening={isListening}
        disabled={isLoading}
        language={language}
        uiLanguage={uiLanguage}
        autoOpenImagePicker={autoOpenImagePicker}
        onImagePickerHandled={onImagePickerHandled}
      />
    </div>
  );
}
