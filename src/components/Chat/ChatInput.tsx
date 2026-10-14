'use client';

import { ImagePlus, Mic, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ChatInput({
  onSend,
  onVoiceInput,
  isListening,
  disabled,
}: {
  onSend: (text: string, image?: File) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      alert('Please select a JPG, PNG, WebP, or GIF image');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert('Image must be under 5MB');
      event.target.value = '';
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImage(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!text.trim() && !image) || disabled) return;
    onSend(text.trim() || 'Please read this image', image ?? undefined);
    setText('');
    clearImage();
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t bg-white">
      {preview && (
        <div className="px-3 pt-3">
          <div className="relative inline-block">
            <img src={preview} alt="Image ready to send" className="h-20 w-20 rounded-lg border object-cover" />
            <button type="button" onClick={clearImage} aria-label="Remove image" className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><X size={12} /></button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageSelect} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} aria-label="Attach image" title="Send image" className="rounded-full bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50"><ImagePlus size={18} /></button>
        <button type="button" onClick={onVoiceInput} disabled={disabled} aria-label={isListening ? 'Stop listening' : 'Voice input'} className={`rounded-full p-2.5 ${isListening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 text-gray-600'} disabled:opacity-50`}><Mic size={18} /></button>
        <input id="chat-input" type="text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type your message..." disabled={disabled} className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button type="submit" disabled={(!text.trim() && !image) || disabled} aria-label="Send message" className="rounded-full bg-emerald-500 p-3 text-white disabled:opacity-50"><Send size={18} /></button>
      </div>
    </form>
  );
}
