'use client';

import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import ChatSidebar from '@/components/Chat/ChatSidebar';
import TextMode from '@/components/Chat/TextMode';
import VoiceMode from '@/components/Chat/VoiceMode';
import WelcomeScreen from '@/components/Chat/WelcomeScreen';
import { speak, stopSpeaking } from '@/lib/speech/textToSpeech';
import { createClient } from '@/lib/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string };
type ChatMode = 'welcome' | 'voice' | 'text';
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<ChatMode>('welcome');
  const [avatarPhoto] = useState('/avatar/avatar-photo.jpg');
  const [currentLanguage, setCurrentLanguage] = useState('ur-PK');
  const [character, setCharacter] = useState('danyal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoListenTimerRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);
  const modeRef = useRef<ChatMode>('welcome');
  const chatGenerationRef = useRef(0);
  const router = useRouter();

  function cancelAutoListen() {
    if (autoListenTimerRef.current !== null) {
      window.clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
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
      if (modeRef.current === 'voice') handleVoiceInput();
    }, 800);
  }

  function speakText(text: string, autoListen = false) {
    if (modeRef.current !== 'voice') return;
    void speak({
      text,
      language: currentLanguage,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        if (autoListen) scheduleAutoListen();
      },
      onError: (error) => {
        setIsSpeaking(false);
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
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeaking(false);
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
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeaking(false);
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
      if (language) setCurrentLanguage(language);
      resetInactivityTimer();
      if (modeRef.current === 'welcome') {
        modeRef.current = 'text';
        setMode('text');
      }
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
      clearInactivityTimer();
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [router]);

  function enterVoiceMode() {
    cancelAutoListen();
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    modeRef.current = 'voice';
    setMode('voice');
    const welcome = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
    setMessages((existing) => [...existing, { role: 'assistant', content: welcome }]);
    speakText(welcome, true);
  }

  function enterTextMode() {
    cancelAutoListen();
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeaking(false);
    setIsListening(false);
    modeRef.current = 'text';
    setMode('text');
    setMessages((existing) => existing.length ? existing : [{ role: 'assistant', content: WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE }]);
  }

  function returnToWelcome() {
    cancelAutoListen();
    stopSpeaking();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsSpeaking(false);
    setIsListening(false);
    modeRef.current = 'welcome';
    setMode('welcome');
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
    stopSpeaking();
    recognitionRef.current?.stop();
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
          history: previousMessages,
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

  function handleVoiceInput() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLanguage;
    setIsListening(true);
    recognition.onresult = (event) => {
      recognitionRef.current = null;
      setIsListening(false);
      void handleSend(event.results[0][0].transcript);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
      recognitionRef.current = null;
      setIsListening(false);
      toast.error('Could not recognize voice');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    try {
      recognition.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      recognitionRef.current = null;
      setIsListening(false);
      toast.error('Could not start voice input');
    }
  }

  function handleNewChat() {
    const nextMode = modeRef.current === 'welcome' ? 'text' : modeRef.current;
    createFreshChat({ greet: true, mode: nextMode });
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
      {modeRef.current === 'welcome' && mode === 'welcome' ? (
        <WelcomeScreen
          onVoiceMode={enterVoiceMode}
          onTextMode={enterTextMode}
          onOpenHistory={() => setSidebarOpen(true)}
        />
      ) : mode === 'voice' ? (
        <VoiceMode
          messages={messages}
          onSend={handleSend}
          onVoiceInput={handleVoiceInput}
          isListening={isListening}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
          photoUrl={avatarPhoto}
          currentLanguage={currentLanguage}
          onLanguageChange={setCurrentLanguage}
          character={character}
          onCharacterChange={handleCharacterChange}
          onSwitchToText={enterTextMode}
          onBack={returnToWelcome}
          onOpenHistory={() => setSidebarOpen(true)}
          onLogout={() => { void handleLogout(); }}
          onTickerTap={() => {
            const conversation = document.getElementById('chat-conversation');
            if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' });
            document.getElementById('chat-input')?.focus({ preventScroll: true });
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
          onLanguageChange={setCurrentLanguage}
          onBackToVoice={enterVoiceMode}
          onOpenHistory={() => setSidebarOpen(true)}
        />
      )}
    </>
  );
}
