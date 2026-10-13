'use client';

import { Mic, Send } from 'lucide-react';
import { useState } from 'react';

export default function ChatInput({
  onSend,
  onVoiceInput,
  isListening,
  disabled,
}: {
  onSend: (text: string) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t bg-white p-3">
      <button
        type="button"
        onClick={onVoiceInput}
        disabled={disabled}
        aria-label={isListening ? 'Stop listening' : 'Use voice input'}
        className={`rounded-full p-3 transition ${
          isListening
            ? 'animate-pulse bg-red-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } disabled:opacity-50`}
      >
        <Mic size={20} />
      </button>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type your message..."
        disabled={disabled}
        className="flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        className="rounded-full bg-emerald-500 p-3 text-white transition hover:bg-emerald-600 disabled:opacity-50"
      >
        <Send size={20} />
      </button>
    </form>
  );
}
