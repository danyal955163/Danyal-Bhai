'use client';

import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import ChatSidebar from '@/components/Chat/ChatSidebar';
import TextMode from '@/components/Chat/TextMode';
import VoiceDashboard from '@/components/Chat/VoiceDashboard';
import { isBackgroundAudioEnabled } from '@/lib/audioSession';
import { loadPreferences, savePreferences, type AppPreferences } from '@/lib/preferences';
import { speak, stopSpeaking } from '@/lib/speech/textToSpeech';
import { createClient } from '@/lib/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string };
type ChatMode = 'voice' | 'text';
type SpeechRecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionResultList = { length: number; [index: number]: SpeechRecognitionResult };
type SpeechRecognitionResultEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const WELCOME_MESSAGE = 'السلام علیکم، میں آپ کی کیا مدد کر سکتا ہوں؟';
const WELCOME_MESSAGES: Record<string, string> = {
  'ur-PK': WELCOME_MESSAGE,
  'en-US': 'Hello, how can I help you today?',
  'ps-AF': 'السلام علیکم، څنګه مرسته درسره کولی شم؟',
};
const WELCOME_CONTENTS = new Set(Object.values(WELCOME_MESSAGES));
const IDLE_TIMEOUT_MS = 60 * 1000;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const [character, setCharacter] = useState('danyal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoListenTimerRef = useRef<number | null>(null);
  const interruptRetryTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const modeRef = useRef<ChatMode>('voice');
  const isSpeakingRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const autoListenEnabledRef = useRef(true);
  const spokenTextRef = useRef('');
  const interruptRetryCountRef = useRef(0);
  const chatGenerationRef = useRef(0);
  const router = useRouter();

  function updateIsSpeaking(value: boolean) {
    isSpeakingRef.current = value;
    setIsSpeakingState(value);
  }

  function applyPreferences(preferences: AppPreferences) {
    setCurrentLanguage(preferences.language);
    setVoiceEnabled(preferences.voiceEnabled);
    voiceEnabledRef.current = preferences.voiceEnabled;
    autoListenEnabledRef.current = preferences.autoListen;
  }

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

  function clearInactivityTimer() {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }

  function scheduleAutoListen() {
    cancelAutoListen();
    autoListenTimerRef.current = window.setTimeout(() => {
      autoListenTimerRef.current = null;
      if (modeRef.current === 'voice' && autoListenEnabledRef.current) startVoiceRecognition(false);
    }, 800);
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
      language: currentLanguage,
      onStart: () => {
        interruptRetryCountRef.current = 0;
        updateIsSpeaking(true);
        startVoiceRecognition(true);
      },
      onEnd: () => {
        updateIsSpeaking(false);
        spokenTextRef.current = '';
        if (recognitionRef.current) stopVoiceRecognition();
        if (autoListen && autoListenEnabledRef.current) scheduleAutoListen();
      },
      onError: (error) => {
        updateIsSpeaking(false);
        if (recognitionRef.current) stopVoiceRecognition();
        console.error('Edge-TTS male voice is unavailable:', error);
        const hasHttpStatus = typeof error === 'object' && error !== null && 'status' in error;
        toast.error(hasHttpStatus
          ? 'Edge-TTS نے error دیا۔ دوبارہ کوشش کریں یا deployment logs چیک کریں۔'
          : 'آواز browser میں play نہیں ہو سکی۔ دوبارہ tap کر کے کوشش کریں۔');
      },
    });
  }

  function createFreshChat(options?: { greet?: boolean; mode?: ChatMode; notify?: boolean }) {
    chatGenerationRef.current += 1;
    clearInactivityTimer();
    cancelAutoListen();
    cancelInterruptRetry();
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
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
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
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
      clearInactivityTimer();
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [router]);

  function enterVoiceMode() {
    cancelAutoListen();
    cancelInterruptRetry();
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
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
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    updateIsSpeaking(false);
    setIsListening(false);
    modeRef.current = 'text';
    setMode('text');
    setMessages((existing) => existing.length ? existing : [{ role: 'assistant', content: WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE }]);
  }

  function changeLanguage(language: string) {
    setCurrentLanguage(language);
    savePreferences({ ...loadPreferences(), language });
  }

  function toggleVoice() {
    const next = !voiceEnabledRef.current;
    voiceEnabledRef.current = next;
    setVoiceEnabled(next);
    savePreferences({ ...loadPreferences(), language: currentLanguage, voiceEnabled: next });
    if (!next) {
      stopSpeaking();
      cancelInterruptRetry();
      if (recognitionRef.current) stopVoiceRecognition();
      updateIsSpeaking(false);
    }
  }

  function handleCharacterChange(id: string) {
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

  async function handleSend(text: string, image?: File) {
    const generation = chatGenerationRef.current;
    const cleanedText = text.trim();
    if (!cleanedText && !image) return;
    let imageUrl: string | undefined;
    let imageBase64: string | undefined;
    if (image) {
      imageUrl = URL.createObjectURL(image);
      try {
        imageBase64 = await fileToDataUrl(image);
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        console.error('Could not read image:', error);
        toast.error('Could not read image');
        return;
      }
    }
    if (generation !== chatGenerationRef.current) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      return;
    }

    const userMessage: Message = { role: 'user', content: cleanedText, imageUrl };
    const previousMessages = messages;
    const historyWithoutWelcome = previousMessages.filter((item) =>
      !(item.role === 'assistant' && WELCOME_CONTENTS.has(item.content)),
    );
    setMessages((existing) => [...existing, userMessage]);
    setIsLoading(true);
    resetInactivityTimer();

    try {
      const conversationId = user ? await ensureConversation(user.id, currentLanguage, generation) : null;
      if (generation !== chatGenerationRef.current) return;
      if (user && conversationId) await saveMessage(user.id, conversationId, 'user', cleanedText, currentLanguage);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanedText,
          history: historyWithoutWelcome,
          language: currentLanguage,
          character,
          imageBase64,
        }),
      });
      const data = await response.json();
      if (generation !== chatGenerationRef.current) return;
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        return;
      }
      const assistantMessage: Message = { role: 'assistant', content: data.reply };
      setMessages((existing) => [...existing, assistantMessage]);
      if (user && conversationId) await saveMessage(user.id, conversationId, 'assistant', data.reply, currentLanguage);
      resetInactivityTimer();
      if (modeRef.current === 'voice') speakText(data.reply, true);
    } catch (error) {
      console.error('Chat request failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      if (generation === chatGenerationRef.current) setIsLoading(false);
    }
  }

  function stopVoiceRecognition() {
    cancelInterruptRetry();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try { recognition.stop(); } catch { /* Recognition may already have ended. */ }
    }
    setIsListening(false);
  }

  function startVoiceRecognition(interruptOnly: boolean) {
    if (recognitionRef.current) {
      if (interruptOnly) return;
      stopVoiceRecognition();
    }

    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (!interruptOnly) toast.error('Voice input is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    let interrupted = false;
    let pendingTranscript = '';
    let sentTranscript = false;
    recognitionRef.current = recognition;
    recognition.continuous = interruptOnly;
    recognition.interimResults = interruptOnly;
    recognition.lang = currentLanguage;
    setIsListening(true);

    recognition.onresult = (event) => {
      if (sentTranscript) return;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript.trim() ?? '';
        if (!transcript) continue;

        const normalized = transcript.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        const spoken = spokenTextRef.current.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        const isExplicitStop = /^(stop|quiet|shut up|بس|خاموش|روکیں|چپ)$/iu.test(normalized);
        const likelyEcho = interruptOnly && !isExplicitStop && normalized.length >= 4 && spoken.includes(normalized);

        if (interruptOnly && isSpeakingRef.current && !likelyEcho) {
          interrupted = true;
          pendingTranscript = transcript;
          stopSpeaking();
          updateIsSpeaking(false);
        }

        if (!result.isFinal) continue;
        if (interruptOnly && likelyEcho && !interrupted) continue;

        const finalTranscript = transcript || pendingTranscript;
        if (finalTranscript) {
          if (isSpeakingRef.current) {
            stopSpeaking();
            updateIsSpeaking(false);
          }
          recognitionRef.current = null;
          setIsListening(false);
          sentTranscript = true;
          try { recognition.stop(); } catch { /* It may already be ending. */ }
          void handleSend(finalTranscript);
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      const code = typeof event === 'object' && event !== null && 'error' in event
        ? String((event as { error: unknown }).error)
        : 'unknown';
      console.info('[Speech recognition] Recognition ended:', code);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      if (code === 'not-allowed' || code === 'service-not-allowed') interruptRetryCountRef.current = 3;
      if (code !== 'no-speech' && code !== 'aborted') toast.error('Could not recognize voice. Check microphone permission.');
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setIsListening(false);
      }
      if (interruptOnly && isSpeakingRef.current && modeRef.current === 'voice' && interruptRetryCountRef.current < 2) {
        interruptRetryCountRef.current += 1;
        cancelInterruptRetry();
        interruptRetryTimerRef.current = window.setTimeout(() => {
          interruptRetryTimerRef.current = null;
          if (isSpeakingRef.current && modeRef.current === 'voice') startVoiceRecognition(true);
        }, 350);
      } else if (interruptOnly && interrupted && pendingTranscript && !sentTranscript) {
        sentTranscript = true;
        void handleSend(pendingTranscript);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      if (!interruptOnly) toast.error('Could not start voice input');
    }
  }

  function handleVoiceInput() {
    cancelAutoListen();
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
          onToggleVoice={toggleVoice}
          onLogout={() => { void handleLogout(); }}
          onSendImage={(image) => {
            const prompt = currentLanguage === 'ur-PK'
              ? 'براہِ کرم اس تصویر کی وضاحت کریں۔'
              : currentLanguage === 'ps-AF'
                ? 'مهرباني وکړئ دا انځور تشریح کړئ.'
                : 'Please describe this image.';
            void handleSend(prompt, image);
          }}
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
        />
      )}
    </>
  );
}
