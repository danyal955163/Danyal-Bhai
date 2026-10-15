'use client';

import { ImagePlus, Mic, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 8;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const UI_COPY: Record<string, { placeholder: string; tooMany: string; invalidType: string; tooLarge: string; attach: string; attachTitle: string; stopListening: string; voiceInput: string; send: string; remove: string; imageAlt: string }> = {
  'ur-PK': { placeholder: 'یہاں اپنا پیغام لکھیں...', tooMany: 'ایک وقت میں زیادہ سے زیادہ 8 تصاویر منسلک کریں۔', invalidType: 'JPG، PNG، WebP یا GIF تصویر منتخب کریں۔', tooLarge: 'تصویر 5 MB سے کم ہونی چاہیے۔', attach: 'تصاویر منسلک کریں', attachTitle: 'زیادہ سے زیادہ 8 تصاویر منسلک کریں', stopListening: 'سننا بند کریں', voiceInput: 'آواز سے پیغام لکھیں', send: 'پیغام بھیجیں', remove: 'تصویر ہٹائیں', imageAlt: 'منسلک تصویر' },
  'en-US': { placeholder: 'Type your message here...', tooMany: 'You can attach up to 8 images at once.', invalidType: 'Choose a JPG, PNG, WebP, or GIF image.', tooLarge: 'The image must be under 5 MB.', attach: 'Attach images', attachTitle: 'Attach up to 8 images', stopListening: 'Stop listening', voiceInput: 'Voice input', send: 'Send message', remove: 'Remove image', imageAlt: 'Attached image' },
  'ps-AF': { placeholder: 'خپل پیغام دلته ولیکئ...', tooMany: 'په یو ځل تر ۸ ډېر انځورونه مه نښلوئ.', invalidType: 'JPG، PNG، WebP یا GIF انځور وټاکئ.', tooLarge: 'انځور باید تر ۵ MB کوچنی وي.', attach: 'انځورونه ونښلوئ', attachTitle: 'تر ۸ انځورونو پورې ونښلوئ', stopListening: 'اورېدل بند کړئ', voiceInput: 'غږیز لیکل', send: 'پیغام ولېږئ', remove: 'انځور لرې کړئ', imageAlt: 'نښلول شوی انځور' },
};

type SelectedImage = { file: File; previewUrl: string };

export default function ChatInput({
  onSend,
  onVoiceInput,
  isListening,
  disabled,
  language,
  uiLanguage,
  autoOpenImagePicker = false,
  onImagePickerHandled,
}: {
  onSend: (text: string, images?: File[]) => void;
  onVoiceInput: () => void;
  isListening: boolean;
  disabled: boolean;
  language: string;
  uiLanguage: string;
  autoOpenImagePicker?: boolean;
  onImagePickerHandled?: () => void;
}) {
  const [text, setText] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePickerOpenedRef = useRef(false);
  const previewUrlsRef = useRef(new Set<string>());
  const isRtl = language === 'ur-PK' || language === 'ps-AF';
  const copy = UI_COPY[uiLanguage] ?? UI_COPY['en-US'];

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
    if (files.length > remaining) window.alert(copy.tooMany);
    const additions: SelectedImage[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        window.alert(`${file.name}: ${copy.invalidType}`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        window.alert(`${file.name}: ${copy.tooLarge}`);
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
    <form lang={uiLanguage} onSubmit={handleSubmit} className="shrink-0 border-t bg-white">
      {selectedImages.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-3 pt-3 sm:grid-cols-8">
          {selectedImages.map(({ file, previewUrl }, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square min-w-0">
              <img src={previewUrl} alt={`${copy.imageAlt} ${index + 1}: ${file.name}`} className="h-full w-full rounded-lg border object-cover" />
              <button type="button" onClick={() => removeImage(index)} aria-label={`${copy.remove} ${index + 1}`} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white"><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageSelect} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || selectedImages.length >= MAX_IMAGES} aria-label={copy.attach} title={copy.attachTitle} className="rounded-full bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50"><ImagePlus size={18} /></button>
        <button type="button" onClick={onVoiceInput} disabled={disabled} aria-label={isListening ? copy.stopListening : copy.voiceInput} className={`rounded-full p-2.5 ${isListening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 text-gray-600'} disabled:opacity-50`}><Mic size={18} /></button>
        <input id="chat-input" type="text" dir={isRtl ? 'rtl' : 'ltr'} lang={language} value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.placeholder} disabled={disabled} className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button type="submit" disabled={(!text.trim() && selectedImages.length === 0) || disabled} aria-label={copy.send} className="rounded-full bg-emerald-500 p-3 text-white disabled:opacity-50"><Send size={18} /></button>
      </div>
    </form>
  );
}
