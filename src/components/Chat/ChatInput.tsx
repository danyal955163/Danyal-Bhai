'use client';

import { ImagePlus, Mic, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 8;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const PLACEHOLDERS: Record<string, string> = {
  'ur-PK': 'یہاں اپنا پیغام لکھیں...',
  'en-US': 'Type your message here...',
  'ps-AF': 'خپل پیغام دلته ولیکئ...',
};

type SelectedImage = { file: File; previewUrl: string };

export default function ChatInput({
  onSend,
  onVoiceInput,
  isListening,
  disabled,
  language,
  autoOpenImagePicker = false,
  onImagePickerHandled,
}: {
  onSend: (text: string, images?: File[]) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  disabled: boolean;
  language: string;
  autoOpenImagePicker?: boolean;
  onImagePickerHandled?: () => void;
}) {
  const [text, setText] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePickerOpenedRef = useRef(false);
  const previewUrlsRef = useRef(new Set<string>());
  const isRtl = language === 'ur-PK' || language === 'ps-AF';

  useEffect(() => {
    if (!autoOpenImagePicker) {
      imagePickerOpenedRef.current = false;
      return;
    }
    if (imagePickerOpenedRef.current) return;
    imagePickerOpenedRef.current = true;
    fileInputRef.current?.click();
    onImagePickerHandled?.();
  }, [autoOpenImagePicker, onImagePickerHandled]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const remaining = MAX_IMAGES - selectedImages.length;
    if (files.length > remaining) window.alert(`You can attach up to ${MAX_IMAGES} images at once.`);
    const additions: SelectedImage[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        window.alert(`${file.name}: choose a JPG, PNG, WebP, or GIF image.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        window.alert(`${file.name}: image must be under 5 MB.`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      additions.push({ file, previewUrl });
    }
    if (additions.length) setSelectedImages((current) => [...current, ...additions]);
    event.target.value = '';
  }

  function removeImage(index: number) {
    const removed = selectedImages[index];
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrlsRef.current.delete(removed.previewUrl);
    }
    setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearImages() {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
    setSelectedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!text.trim() && selectedImages.length === 0) || disabled) return;
    const prompt = text.trim() || (language === 'ur-PK'
      ? 'براہِ کرم منسلک تصاویر کی وضاحت کریں۔'
      : language === 'ps-AF'
        ? 'مهرباني وکړئ دا انځورونه تشریح کړئ.'
        : 'Please describe the attached images.');
    onSend(prompt, selectedImages.map(({ file }) => file));
    setText('');
    clearImages();
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t bg-white">
      {selectedImages.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-3 pt-3 sm:grid-cols-8">
          {selectedImages.map(({ file, previewUrl }, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square min-w-0">
              <img src={previewUrl} alt={`Image ${index + 1}: ${file.name}`} className="h-full w-full rounded-lg border object-cover" />
              <button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white"><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageSelect} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || selectedImages.length >= MAX_IMAGES} aria-label="Attach images" title={`Attach up to ${MAX_IMAGES} images`} className="rounded-full bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50"><ImagePlus size={18} /></button>
        <button type="button" onClick={onVoiceInput} disabled={disabled} aria-label={isListening ? 'Stop listening' : 'Voice input'} className={`rounded-full p-2.5 ${isListening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 text-gray-600'} disabled:opacity-50`}><Mic size={18} /></button>
        <input
          id="chat-input"
          type="text"
          dir={isRtl ? 'rtl' : 'ltr'}
          lang={language}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={PLACEHOLDERS[language] ?? PLACEHOLDERS['en-US']}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="submit" disabled={(!text.trim() && selectedImages.length === 0) || disabled} aria-label="Send message" className="rounded-full bg-emerald-500 p-3 text-white disabled:opacity-50"><Send size={18} /></button>
      </div>
    </form>
  );
}
