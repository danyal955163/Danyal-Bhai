'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const conversationIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autoListenTimerRef = useRef<number | null>(null);
  const modeRef = useRef<ChatMode>('welcome');
  const voiceEnabledRef = useRef(true);
  const router = useRouter();

  function cancelAutoListen() {
    if (autoListenTimerRef.current !== null) {
      window.clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
  }

  function scheduleAutoListen() {
    cancelAutoListen();
    autoListenTimerRef.current = window.setTimeout(() => {
      autoListenTimerRef.current = null;
      if (modeRef.current === 'voice' && voiceEnabledRef.current) handleVoiceInput();
    }, 800);
  }

  async function getTodayConversation(userId: string, language: string) {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) {
      console.error('Could not find today conversation:', findError);
      return null;
    }
    if (existing?.id) return existing.id as string;

    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({ user_id: userId, language })
      .select('id')
      .single();
    if (createError) {
      console.error('Could not create conversation:', createError);
      return null;
    }
    return created?.id as string | null;
  }

  async function saveMessage(userId: string, role: 'user' | 'assistant', content: string, language: string) {
    const supabase = createClient();
    const conversationId = conversationIdRef.current ?? await getTodayConversation(userId, language);
    if (!conversationId) return;
    conversationIdRef.current = conversationId;
    const { error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: userId, role, content, language });
    if (error) console.error(`Could not save ${role} message:`, error);
  }

  async function loadChatHistory(currentUser: User) {
    const conversationId = await getTodayConversation(currentUser.id, currentLanguage);
    if (!conversationId) return;
    conversationIdRef.current = conversationId;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, language')
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Could not load chat history:', error);
      return;
    }
    const history = (data ?? [])
      .reverse()
      .filter((item) => (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .map((item) => ({ role: item.role as 'user' | 'assistant', content: item.content }));
    if (history.length) setMessages(history);
  }

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        router.replace('/login');
        setLoading(false);
        return;
      }
      setUser(data.user);
      await loadChatHistory(data.user);
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
      cancelAutoListen();
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [router]);

  function speakText(text: string, autoListen = false) {
    if (!voiceEnabled || mode !== 'voice') return;
    void speak({
      text,
      language: currentLanguage,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        if (autoListen) scheduleAutoListen();
      },
      onError: () => setIsSpeaking(false),
    });
  }

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
    if (!voiceEnabled) return;

    // The explicit button click grants a natural point to request speech and microphone access.
    void speak({
      text: welcome,
      language: currentLanguage,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        scheduleAutoListen();
      },
      onError: () => setIsSpeaking(false),
    });
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
    setMessages((existing) => existing.length
      ? existing
      : [{ role: 'assistant', content: WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE }]);
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
    const welcome = id === 'teacher'
      ? 'میں پڑھانے میں مدد کر سکتا ہوں۔ آپ کیا سیکھنا چاہیں گے؟'
      : id === 'friend'
        ? 'کیسے ہیں؟ کیا حال ہے؟'
        : id === 'guide'
          ? 'میں آپ کی رہنمائی کر سکتا ہوں۔ آپ کہاں جانا چاہتے ہیں؟'
          : (WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE);
    setMessages((existing) => [...existing, { role: 'assistant', content: welcome }]);
    speakText(welcome, true);
  }

  async function handleLogout() {
    cancelAutoListen();
    stopSpeaking();
    recognitionRef.current?.stop();
    await createClient().auth.signOut();
    router.replace('/login');
  }

  async function handleSend(text: string, image?: File) {
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

    const userMessage: Message = { role: 'user', content: text, imageUrl };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    if (user) await saveMessage(user.id, 'user', text, currentLanguage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          language: currentLanguage,
          character,
          imageBase64,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        return;
      }
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      if (user) await saveMessage(user.id, 'assistant', data.reply, currentLanguage);
      if (mode === 'voice') speakText(data.reply, true);
    } catch (error) {
      console.error('Chat request failed:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
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

  function toggleVoice() {
    if (voiceEnabled) {
      cancelAutoListen();
      stopSpeaking();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsSpeaking(false);
      setIsListening(false);
    }
    const nextEnabled = !voiceEnabled;
    voiceEnabledRef.current = nextEnabled;
    setVoiceEnabled(nextEnabled);
  }

  function handleTickerTap() {
    const conversation = document.getElementById('chat-conversation');
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' });
    document.getElementById('chat-input')?.focus({ preventScroll: true });
  }

  async function handleLogoutAction() {
    await handleLogout();
  }

  if (loading || !user) {
    return <div className="flex h-[100dvh] items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50 text-gray-500">Loading...</div>;
  }

  if (mode === 'welcome') {
    return <WelcomeScreen onVoiceMode={enterVoiceMode} onTextMode={enterTextMode} />;
  }

  if (mode === 'voice') {
    return (
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
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
        onSwitchToText={enterTextMode}
        onBack={returnToWelcome}
        onLogout={handleLogoutAction}
        onTickerTap={handleTickerTap}
      />
    );
  }

  return (
    <TextMode
      messages={messages}
      onSend={handleSend}
      onVoiceInput={handleVoiceInput}
      isListening={isListening}
      isLoading={isLoading}
      currentLanguage={currentLanguage}
      onLanguageChange={setCurrentLanguage}
      onBackToVoice={enterVoiceMode}
      onLogout={handleLogoutAction}
    />
  );
}
