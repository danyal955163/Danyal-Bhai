'use client';

import { Check, Copy, FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
};

export default function ChatBubble({ role, content, imageUrl, imageUrls }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
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
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-br-sm bg-emerald-500 text-white' : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'}`}>
          {(imageUrls?.length || imageUrl) && <div className="mb-2 grid max-w-full grid-cols-2 gap-1.5">{(imageUrls?.length ? imageUrls : imageUrl ? [imageUrl] : []).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Uploaded image ${index + 1}`} className="max-h-48 max-w-full rounded-lg object-cover" />)}</div>}
          {content}
          {!isUser && content.length > 200 && <button type="button" onClick={handleSavePdf} disabled={savingPdf} className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 underline hover:text-emerald-600 disabled:opacity-50"><FileDown size={12} />{savingPdf ? 'Preparing PDF...' : 'Save as PDF'}</button>}
        </div>
        <button type="button" onClick={handleCopy} aria-label={copied ? 'Message copied' : 'Copy message'} title={copied ? 'Copied' : 'Copy message'} className={`absolute -bottom-2 ${isUser ? 'left-2' : 'right-2'} rounded-full bg-white p-1.5 shadow-md opacity-100 transition-opacity duration-200 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${isUser ? 'hover:bg-emerald-50' : 'hover:bg-gray-100'}`}>{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-gray-500" />}</button>
      </div>
    </div>
  );
}
