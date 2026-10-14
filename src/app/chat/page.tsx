'use client';

import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import ChatSidebar from '@/components/Chat/ChatSidebar';
import TextMode from '@/components/Chat/TextMode';
import VoiceDashboard from '@/components/Chat/VoiceDashboard';
import { isBackgroundAudioEnabled } from '@/lib/audioSession';
import { loadPreferences, savePreferences, type AppPreferences, type NoiseFilterLevel } from '@/lib/preferences';
import { createSpeechRecognition, type SpeechRecognitionInstance } from '@/lib/speech/speechToText';
import { speak, stopSpeaking } from '@/lib/speech/textToSpeech';
import { VoiceActivityDetector } from '@/lib/speech/voiceActivityDetector';
import { createClient } from '@/lib/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; imageUrls?: string[] };
type ChatMode = 'voice' | 'text';

const WELCOME_MESSAGE = 'السلام علیکم، میں آپ کی کیا مدد کر سکتا ہوں؟';
const WELCOME_MESSAGES: Record<string, string> = {
  'ur-PK': WELCOME_MESSAGE,
  'en-US': 'Hello, how can I help you today?',
  'ps-AF': 'السلام علیکم، څنګه مرسته درسره کولی شم؟',
};
const WELCOME_CONTENTS = new Set(Object.values(WELCOME_MESSAGES));
const IDLE_TIMEOUT_MS = 60 * 1000;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function compressImageToDataUrl(file: File) {
  if (typeof createImageBitmap !== 'function') return blobToDataUrl(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return blobToDataUrl(file);
  }
  try {
    for (const [maxDimension, quality] of [[1280, 0.76], [960, 0.66], [768, 0.56]] as const) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the selected image.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not compress the selected image.')), 'image/jpeg', quality);
      });
      if (blob.size <= 260_000 || maxDimension === 768) return blobToDataUrl(blob);
    }
    throw new Error('Could not compress the selected image.');
  } finally {
    bitmap.close();
  }
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeakingState] = useState(false);
  const [mode, setMode] = useState<ChatMode>('voice');
  const [avatarPhoto] = useState('/avatar/avatar-photo.jpg');
  const [currentLanguage, setCurrentLanguage] = useState('ur-PK');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [noiseFilterLevel, setNoiseFilterLevel] = useState<NoiseFilterLevel>('medium');
  const [imagePickerPending, setImagePickerPending] = useState(false);
  const [character, setCharacter] = useState('danyal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const messageImageUrlsRef = useRef(new Set<string>());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const vadReadyRef = useRef(false);
  const lastVadVoiceAtRef = useRef(0);
  const silenceTimerRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const listenRequestedRef = useRef(false);
  const interruptMonitorRef = useRef(false);
  const currentLanguageRef = useRef(currentLanguage);
  const characterRef = useRef(character);
  const autoListenTimerRef = useRef<number | null>(null);
  const interruptRetryTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const modeRef = useRef<ChatMode>('voice');
  const isSpeakingRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const autoListenEnabledRef = useRef(true);
  const spokenTextRef = useRef('');
  const chatGenerationRef = useRef(0);
  const router = useRouter();

  function updateIsSpeaking(value: boolean) {
    isSpeakingRef.current = value;
    setIsSpeakingState(value);
  }

  function applyPreferences(preferences: AppPreferences) {
    setCurrentLanguage(preferences.language);
    setVoiceEnabled(preferences.voiceEnabled);
    setNoiseFilterLevel(preferences.noiseFilterLevel);
    voiceEnabledRef.current = preferences.voiceEnabled;
    autoListenEnabledRef.current = preferences.autoListen;
    currentLanguageRef.current = preferences.language;
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let preferences = loadPreferences();
    if (preferences.backgroundMode && !isBackgroundAudioEnabled()) {
      preferences = { ...preferences, backgroundMode: false };
      savePreferences(preferences);
    }
    applyPreferences(preferences);
    const handlePreferences = (event: Event) => {
      const next = (event as CustomEvent<AppPreferences>).detail;
      if (next) applyPreferences(next);
    };
    window.addEventListener('me-ai:preferences', handlePreferences);
    return () => window.removeEventListener('me-ai:preferences', handlePreferences);
  }, []);

  useEffect(() => {
    if (!isListening) {
      vadRef.current?.stop();
      vadRef.current = null;
      vadReadyRef.current = false;
      lastVadVoiceAtRef.current = 0;
      return;
    }

    const detector = new VoiceActivityDetector(noiseFilterLevel);
    let cancelled = false;
    vadRef.current = detector;
    vadReadyRef.current = false;
    lastVadVoiceAtRef.current = 0;
    void detector.start(() => { lastVadVoiceAtRef.current = Date.now(); }).then((started) => {
      if (!cancelled && vadRef.current === detector) vadReadyRef.current = started;
    });

    return () => {
      cancelled = true;
      if (vadRef.current === detector) {
        detector.stop();
        vadRef.current = null;
        vadReadyRef.current = false;
        lastVadVoiceAtRef.current = 0;
      }
    };
  }, [isListening, mode, noiseFilterLevel]);

  function cancelAutoListen() {
    if (autoListenTimerRef.current !== null) {
      window.clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
  }

  function cancelInterruptRetry() {
    if (interruptRetryTimerRef.current !== null) {
      window.clearTimeout(interruptRetryTimerRef.current);
      interruptRetryTimerRef.current = null;
    }
  }

  function cancelSilenceTimer() {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function clearInactivityTimer() {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }

  function revokeMessageImageUrls() {
    messageImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    messageImageUrlsRef.current.clear();
  }

  function scheduleAutoListen() {
    cancelAutoListen();
    autoListenTimerRef.current = window.setTimeout(() => {
      autoListenTimerRef.current = null;
      if (modeRef.current === 'voice' && autoListenEnabledRef.current) startVoiceRecognition(false);
    }, 800);
  }

  function scheduleSilenceSubmission() {
    cancelSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      const fullText = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim();
      if (fullText.length <= 2) return;
      stopVoiceRecognition();
      void handleSend(fullText);
    }, 1_500);
  }

  function speakText(text: string, autoListen = false) {
    if (modeRef.current !== 'voice') return;
    spokenTextRef.current = text;
    if (!voiceEnabledRef.current) {
      updateIsSpeaking(false);
      if (autoListen && autoListenEnabledRef.current) scheduleAutoListen();
      return;
    }
    cancelAutoListen();
    cancelInterruptRetry();
    void speak({
      text,
      language: currentLanguageRef.current,
      onStart: () => {
        updateIsSpeaking(true);
        startVoiceRecognition(true);
      },
      onEnd: () => {
        updateIsSpeaking(false);
        spokenTextRef.current = '';
        stopVoiceRecognition();
        if (autoListen && autoListenEnabledRef.current) scheduleAutoListen();
      },
      onError: (error) => {
        updateIsSpeaking(false);
        stopVoiceRecognition();
        console.error('Edge-TTS male voice is unavailable:', error);
        const hasHttpStatus = typeof error === 'object' && error !== null && 'status' in error;
        toast.error(hasHttpStatus
          ? 'Edge-TTS نے error دیا۔ دوبارہ کوشش کریں یا deployment logs چیک کریں۔'
          : 'آواز browser میں play نہیں ہو سکی۔ دوبارہ tap کر کے کوشش کریں۔');
        if (autoListen && autoListenEnabledRef.current) scheduleAutoListen();
      },
    });
  }

  function createFreshChat(options?: { greet?: boolean; mode?: ChatMode; notify?: boolean }) {
    chatGenerationRef.current += 1;
    clearInactivityTimer();
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    revokeMessageImageUrls();
    updateIsSpeaking(false);
    setIsListening(false);
    setIsLoading(false);
    conversationIdRef.current = null;
    setCurrentConversationId(null);

    const nextMode = options?.mode ?? modeRef.current;
    modeRef.current = nextMode;
    setMode(nextMode);
    const greeting = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
    setMessages(options?.greet ? [{ role: 'assistant', content: greeting }] : []);

    if (options?.greet && nextMode === 'voice') speakText(greeting, true);
    if (options?.notify) toast.success('نیا چیٹ شروع ہو گیا');
  }

  function resetInactivityTimer() {
    clearInactivityTimer();
    inactivityTimerRef.current = window.setTimeout(() => {
      inactivityTimerRef.current = null;
      createFreshChat({ greet: true, notify: true });
    }, IDLE_TIMEOUT_MS);
  }

  async function ensureConversation(userId: string, language: string, generation: number) {
    if (conversationIdRef.current) return conversationIdRef.current;
    const { data, error } = await createClient()
      .from('conversations')
      .insert({ user_id: userId, language })
      .select('id')
      .single();
    if (error || !data?.id) {
      console.error('Could not create a chat conversation:', error);
      throw new Error('Could not save this chat. Please try again.');
    }
    const id = data.id as string;
    if (generation !== chatGenerationRef.current) return null;
    conversationIdRef.current = id;
    setCurrentConversationId(id);
    return id;
  }

  async function saveMessage(userId: string, conversationId: string, role: 'user' | 'assistant', content: string, language: string) {
    const { error } = await createClient()
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: userId, role, content, language });
    if (error) console.error(`Could not save ${role} message:`, error);
  }

  async function loadConversation(conversationId: string, language?: string | null) {
    if (!user) return;
    const generation = ++chatGenerationRef.current;
    clearInactivityTimer();
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    revokeMessageImageUrls();
    updateIsSpeaking(false);
    setIsListening(false);
    setIsLoading(true);

    try {
      const { data, error } = await createClient()
        .from('messages')
        .select('role, content, language')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      if (generation !== chatGenerationRef.current) return;
      const loaded = (data ?? [])
        .filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
        .map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content }));
      conversationIdRef.current = conversationId;
      setCurrentConversationId(conversationId);
      setMessages(loaded);
      if (language) {
        setCurrentLanguage(language);
        currentLanguageRef.current = language;
        savePreferences({ ...loadPreferences(), language });
      }
      resetInactivityTimer();
      modeRef.current = 'text';
      setMode('text');
    } catch (error) {
      if (generation !== chatGenerationRef.current) return;
      console.error('Could not open conversation:', error);
      toast.error('Could not open this chat');
    } finally {
      if (generation === chatGenerationRef.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    createClient().auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        router.replace('/login');
        setLoading(false);
        return;
      }
      setUser(data.user);
      setLoading(false);
    }).catch((error: unknown) => {
      console.error('Could not verify sign-in:', error);
      if (mounted) {
        router.replace('/login');
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      cancelAutoListen();
      cancelInterruptRetry();
      cancelSilenceTimer();
      clearInactivityTimer();
      stopSpeaking();
      listenRequestedRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      vadRef.current?.stop();
      vadRef.current = null;
      revokeMessageImageUrls();
    };
  }, [router]);

  function enterVoiceMode() {
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    setIsListening(false);
    updateIsSpeaking(false);
    modeRef.current = 'voice';
    setMode('voice');
    const welcome = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
    setMessages((existing) => [...existing, { role: 'assistant', content: welcome }]);
    speakText(welcome, true);
  }

  function enterTextMode() {
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    updateIsSpeaking(false);
    setIsListening(false);
    modeRef.current = 'text';
    setMode('text');
    setImagePickerPending(false);
    setMessages((existing) => existing.length ? existing : [{ role: 'assistant', content: WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE }]);
  }

  function enterImageMode() {
    enterTextMode();
    setImagePickerPending(true);
  }

  function changeLanguage(language: string) {
    setCurrentLanguage(language);
    currentLanguageRef.current = language;
    savePreferences({ ...loadPreferences(), language });
  }

  function toggleVoice() {
    const next = !voiceEnabledRef.current;
    voiceEnabledRef.current = next;
    setVoiceEnabled(next);
    savePreferences({ ...loadPreferences(), language: currentLanguage, voiceEnabled: next });
    if (!next) {
      stopSpeaking();
      cancelAutoListen();
      stopVoiceRecognition();
      updateIsSpeaking(false);
    }
  }

  function handleCharacterChange(id: string) {
    characterRef.current = id;
    setCharacter(id);
    const greeting = id === 'teacher'
      ? 'میں پڑھانے میں مدد کر سکتا ہوں۔ آپ کیا سیکھنا چاہیں گے؟'
      : id === 'friend'
        ? 'کیسے ہیں؟ کیا حال ہے؟'
        : id === 'guide'
          ? 'میں آپ کی رہنمائی کر سکتا ہوں۔ آپ کہاں جانا چاہتے ہیں؟'
          : (WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE);
    setMessages((existing) => [...existing, { role: 'assistant', content: greeting }]);
    speakText(greeting, true);
  }

  async function handleLogout() {
    clearInactivityTimer();
    cancelAutoListen();
    cancelInterruptRetry();
    stopSpeaking();
    stopVoiceRecognition();
    await createClient().auth.signOut();
    router.replace('/login');
  }

  async function handleSend(text: string, images: File[] = []) {
    const generation = chatGenerationRef.current;
    const requestLanguage = currentLanguageRef.current;
    const cleanedText = text.trim();
    const selectedImages = images.slice(0, 8);
    if (!cleanedText && selectedImages.length === 0) return;
    const imageUrls = selectedImages.map((image) => URL.createObjectURL(image));
    let imageDataUrls: string[];
    try {
      imageDataUrls = await Promise.all(selectedImages.map(compressImageToDataUrl));
      const totalImageChars = imageDataUrls.reduce((total, dataUrl) => total + dataUrl.length, 0);
      if (totalImageChars > 3_200_000) throw new Error('These images are too large to send together. Choose fewer images or smaller files.');
    } catch (error) {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
      console.error('Could not prepare selected images:', error);
      toast.error(error instanceof Error ? error.message : 'Could not read selected images');
      return;
    }
    if (generation !== chatGenerationRef.current) {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
      return;
    }

    const userMessage: Message = { role: 'user', content: cleanedText, imageUrls: imageUrls.length ? imageUrls : undefined };
    const previousMessages = messagesRef.current;
    const historyWithoutWelcome = previousMessages.filter((item) =>
      !(item.role === 'assistant' && WELCOME_CONTENTS.has(item.content)),
    );
    imageUrls.forEach((url) => messageImageUrlsRef.current.add(url));
    setMessages((existing) => [...existing, userMessage]);
    setIsLoading(true);
    resetInactivityTimer();

    try {
      const conversationId = user ? await ensureConversation(user.id, requestLanguage, generation) : null;
      if (generation !== chatGenerationRef.current) return;
      if (user && conversationId) await saveMessage(user.id, conversationId, 'user', cleanedText, requestLanguage);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanedText,
          history: historyWithoutWelcome,
          language: requestLanguage,
          character: characterRef.current,
          images: imageDataUrls,
        }),
      });
      const data = await response.json();
      if (generation !== chatGenerationRef.current) return;
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        if (modeRef.current === 'voice' && autoListenEnabledRef.current) scheduleAutoListen();
        return;
      }
      const assistantMessage: Message = { role: 'assistant', content: data.reply };
      setMessages((existing) => [...existing, assistantMessage]);
      if (user && conversationId) await saveMessage(user.id, conversationId, 'assistant', data.reply, requestLanguage);
      resetInactivityTimer();
      if (modeRef.current === 'voice') speakText(data.reply, true);
    } catch (error) {
      console.error('Chat request failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      if (modeRef.current === 'voice' && autoListenEnabledRef.current) scheduleAutoListen();
    } finally {
      if (generation === chatGenerationRef.current) setIsLoading(false);
    }
  }

  function stopVoiceRecognition(updateUi = true) {
    listenRequestedRef.current = false;
    interruptMonitorRef.current = false;
    cancelInterruptRetry();
    cancelSilenceTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.stop(); } catch { /* Recognition may already have ended. */ }
    }
    vadRef.current?.stop();
    vadRef.current = null;
    vadReadyRef.current = false;
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    if (updateUi) setIsListening(false);
  }

  function startVoiceRecognition(interruptOnly: boolean, resetTranscript = true) {
    if (recognitionRef.current) {
      if (interruptOnly) return;
      stopVoiceRecognition();
    }

    const recognition = createSpeechRecognition(currentLanguageRef.current);
    if (!recognition) {
      listenRequestedRef.current = false;
      if (!interruptOnly) toast.error('Voice input is not supported in this browser');
      return;
    }

    cancelInterruptRetry();
    listenRequestedRef.current = true;
    interruptMonitorRef.current = interruptOnly;
    if (resetTranscript) {
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
    }
    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      let acceptedSpeech = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript.trim() ?? '';
        if (!transcript) continue;

        const normalized = transcript.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        const spoken = spokenTextRef.current.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        const isExplicitStop = /^(stop|quiet|shut up|بس|خاموش|روکیں|چپ)$/iu.test(normalized);
        const likelyAssistantEcho = interruptMonitorRef.current && !isExplicitStop && normalized.length >= 4 && spoken.includes(normalized);
        if (likelyAssistantEcho) continue;

        const vadHasRecentVoice = !vadReadyRef.current || Date.now() - lastVadVoiceAtRef.current < 1_200;
        if (!vadHasRecentVoice) continue;

        if (interruptMonitorRef.current && isSpeakingRef.current) {
          stopSpeaking();
          updateIsSpeaking(false);
          interruptMonitorRef.current = false;
        }

        if (result.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.replace(/\s+/g, ' ').trim();
          interimTranscriptRef.current = '';
        } else {
          interimTranscriptRef.current = transcript;
        }
        acceptedSpeech = true;
      }
      if (acceptedSpeech) scheduleSilenceSubmission();
    };

    recognition.onerror = (event) => {
      const code = typeof event === 'object' && event !== null && 'error' in event
        ? String((event as { error: unknown }).error)
        : 'unknown';
      console.info('[Speech recognition] Recognition ended:', code);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        listenRequestedRef.current = false;
        vadRef.current?.stop();
        vadRef.current = null;
        vadReadyRef.current = false;
        setIsListening(false);
        toast.error('Microphone permission is required for voice input.');
      } else if (code !== 'no-speech' && code !== 'aborted') {
        toast.error('Could not recognize voice. Check microphone permission.');
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!listenRequestedRef.current || modeRef.current !== 'voice') {
        setIsListening(false);
        return;
      }
      setIsListening(false);
      cancelInterruptRetry();
      interruptRetryTimerRef.current = window.setTimeout(() => {
        interruptRetryTimerRef.current = null;
        if (listenRequestedRef.current && modeRef.current === 'voice' && !recognitionRef.current) {
          startVoiceRecognition(interruptMonitorRef.current, false);
        }
      }, 300);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      recognitionRef.current = null;
      listenRequestedRef.current = false;
      setIsListening(false);
      if (!interruptOnly) toast.error('Could not start voice input');
    }
  }

  function handleVoiceInput() {
    cancelAutoListen();
    cancelInterruptRetry();
    if (recognitionRef.current) {
      stopVoiceRecognition();
      return;
    }
    startVoiceRecognition(false);
  }

  function handleNewChat() {
    createFreshChat({ greet: true, mode: modeRef.current });
  }

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50 text-gray-500">Loading...</div>;
  }
  if (!user) return null;

  return (
    <>
      <Toaster position="top-center" />
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={(id, language) => { void loadConversation(id, language); }}
      />
      {mode === 'voice' ? (
        <VoiceDashboard
          photoUrl={avatarPhoto}
          isSpeaking={isSpeaking}
          isListening={isListening}
          isLoading={isLoading}
          statusText={isLoading ? 'Thinking…' : isSpeaking && isListening ? 'Speaking · listening for interruption' : isSpeaking ? 'Speaking…' : isListening ? 'Listening…' : 'Ready — tap to talk'}
          voiceEnabled={voiceEnabled}
          character={character}
          onCharacterChange={handleCharacterChange}
          onVoiceInput={handleVoiceInput}
          onOpenHistory={() => setSidebarOpen(true)}
          onSettings={() => router.push('/settings')}
          onTextMode={enterTextMode}
          onImageMode={enterImageMode}
          onToggleVoice={toggleVoice}
          onLogout={() => { void handleLogout(); }}
        />
      ) : (
        <TextMode
          messages={messages}
          onSend={handleSend}
          onVoiceInput={handleVoiceInput}
          isListening={isListening}
          isLoading={isLoading}
          currentLanguage={currentLanguage}
          onLanguageChange={changeLanguage}
          onBackToVoice={enterVoiceMode}
          onOpenHistory={() => setSidebarOpen(true)}
          autoOpenImagePicker={imagePickerPending}
          onImagePickerHandled={() => setImagePickerPending(false)}
        />
      )}
    </>
  );
}
