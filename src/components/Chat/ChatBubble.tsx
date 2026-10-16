'use client';

import { Check, Copy, EllipsisVertical, FileDown, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  onDelete?: () => void;
};

export default function ChatBubble({ role, content, imageUrl, onDelete }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  async function handleSavePdf() {
    setSavingPdf(true);
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title: 'Danyal AI Response' }),
      });
      if (!response.ok) throw new Error('PDF request failed');
      const html = await response.text();
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Popup blocked');
      printWindow.document.write(html);
      printWindow.document.close();
      window.setTimeout(() => printWindow.print(), 500);
    } catch (error) {
      console.error('Could not prepare PDF:', error);
    } finally {
      setSavingPdf(false);
    }
  }

  return (
    <div className={`group mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="relative max-w-[80%]">
        <div className={`absolute -top-3 ${isUser ? 'left-0' : 'right-0'} z-10`}>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Message options" title="Message options" className="rounded-full bg-white p-1 text-gray-400 shadow-sm hover:text-gray-700"><EllipsisVertical size={15} /></button>
          {menuOpen && (
            <div className={`absolute top-7 ${isUser ? 'left-0' : 'right-0'} min-w-32 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl`}>
              <button type="button" onClick={() => { setMenuOpen(false); onDelete?.(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-br-sm bg-emerald-500 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'}`}>
          {imageUrl && <img src={imageUrl} alt="Uploaded" className="mb-2 max-h-48 max-w-full rounded-lg object-cover" />}
          {content}
          {!isUser && content.length > 200 && <button type="button" onClick={handleSavePdf} disabled={savingPdf} className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 underline hover:text-emerald-600 disabled:opacity-50"><FileDown size={12} />{savingPdf ? 'Preparing PDF...' : 'Save as PDF'}</button>}
        </div>
        <button type="button" onClick={handleCopy} aria-label={copied ? 'Message copied' : 'Copy message'} title={copied ? 'Copied' : 'Copy message'} className={`absolute -bottom-2 ${isUser ? 'left-2' : 'right-2'} rounded-full bg-white p-1.5 shadow-md opacity-100 transition-opacity duration-200 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${isUser ? 'hover:bg-emerald-50' : 'hover:bg-gray-100'}`}>{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-gray-500" />}</button>
      </div>
    </div>
  );
}
