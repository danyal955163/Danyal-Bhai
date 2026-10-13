'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
    } catch (error) {
      console.error('Could not copy message:', error);
    }
  }

  return (
    <div className={`group mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-sm bg-emerald-500 text-white'
              : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
          }`}
        >
          {content}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Message copied' : 'Copy message'}
          title={copied ? 'Copied' : 'Copy message'}
          className={`absolute -bottom-2 ${isUser ? 'left-2' : 'right-2'} rounded-full bg-white p-1.5 shadow-md opacity-100 transition-opacity duration-200 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
            isUser ? 'hover:bg-emerald-50' : 'hover:bg-gray-100'
          }`}
        >
          {copied ? (
            <Check size={12} className="text-emerald-500" />
          ) : (
            <Copy size={12} className="text-gray-500" />
          )}
        </button>
      </div>
    </div>
  );
}
