'use client';

import { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatInterface({
  messages,
  onSend,
  onVoiceInput,
  isListening,
  isLoading,
}: {
  messages: Message[];
  onSend: (text: string) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  isLoading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">
            Start a conversation by typing or speaking
          </div>
        )}
        {messages.map((message, index) => (
          <ChatBubble key={`${message.role}-${index}`} {...message} />
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
      />
    </div>
  );
}
