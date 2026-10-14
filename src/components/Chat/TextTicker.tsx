'use client';

import { Volume2 } from 'lucide-react';

type TickerMessage = { role: 'user' | 'assistant'; content: string };

export default function TextTicker({
  messages,
  onTap,
}: {
  messages: TickerMessage[];
  onTap: () => void;
}) {
  const latest = messages.at(-1);
  if (!latest) {
    return (
      <div className="flex h-16 shrink-0 items-center justify-center border-y border-emerald-200/50 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 px-4 text-xs text-gray-500">
        Your latest message will appear here
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Open the latest message in the chat"
      title="Tap to open the chat"
      className="h-16 w-full shrink-0 border-y border-emerald-200/50 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 px-4 py-2 transition hover:bg-emerald-50"
    >
      <div className="flex items-center gap-3">
        <Volume2 size={16} className="shrink-0 animate-pulse text-emerald-600" />
        <div className="flex-1 overflow-hidden">
          <p className="animate-ticker whitespace-nowrap text-left text-sm text-gray-700">
            {latest.content}
          </p>
        </div>
      </div>
      <p className="mt-1 text-left text-[10px] text-gray-400">Tap to open the full chat</p>
    </button>
  );
}
