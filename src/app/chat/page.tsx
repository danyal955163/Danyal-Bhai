'use client';

import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import Avatar from '@/components/Avatar/Avatar';
import CharacterSelector, { CHARACTERS } from '@/components/Chat/CharacterSelector';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';
import TextTicker from '@/components/Chat/TextTicker';
import { cancelSpeech, speakWithFallback } from '@/lib/speech/textToSpeech';
import { createClient } from '@/lib/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string };
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const WELCOME_MESSAGES: Record<string, string> = {
  'ur-PK': 'السلام علیکم، میں می AI ہوں۔ آپ کی کیا مدد کر سکتا ہوں؟',
  'en-US': 'Assalam-o-Alaikum! I am Me AI. How can I help you today?',
  'ps-AF': 'السلام علیکم، زه دانيال AI یم. څنګه مرسته درسره کولی شم؟',
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
  const [avatarPhoto] = useState('/avatar/avatar-photo.jpg');
  const [currentLanguage, setCurrentLanguage] = useState('ur-PK');
  const [character, setCharacter] = useState('danyal');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const conversationIdRef = useRef<string | null>(null);
  const hasWelcomed = useRef(false);
  const router = useRouter();

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
      cancelSpeech();
    };
  }, [router]);

  useEffect(() => {
    if (loading || !user || hasWelcomed.current) return;
    hasWelcomed.current = true;
    const welcome = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGES['ur-PK'];
    setMessages((existing) => [...existing, { role: 'assistant', content: welcome }]);

    if (!voiceEnabled) return;
    const welcomeTimer = window.setTimeout(() => {
      void speakWithFallback({
        text: welcome,
        language: currentLanguage,
        pitch: 0.7,
        rate: 0.9,
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          window.setTimeout(() => handleVoiceInput(), 800);
        },
        onError: () => setIsSpeaking(false),
      });
    }, 500);
    return () => window.clearTimeout(welcomeTimer);
  }, [loading, user, voiceEnabled, currentLanguage]);

  function speakText(text: string, language = currentLanguage) {
    if (!voiceEnabled) return;
    void speakWithFallback({
      text,
      language,
      pitch: 0.7,
      rate: 0.9,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  function handleCharacterChange(id: string) {
    if (!CHARACTERS.some((item) => item.id === id)) return;
    setCharacter(id);
    const welcome = id === 'teacher'
      ? 'میں اردو، انگریزی اور پشتو میں پڑھانے میں مدد کر سکتا ہوں۔ آپ کیا سیکھنا چاہیں گے؟'
      : id === 'friend'
        ? 'کیسے ہیں؟ کیا حال ہے؟'
        : id === 'guide'
          ? 'میں آپ کی رہنمائی کر سکتا ہوں۔ آپ کہاں جانا چاہتے ہیں؟'
          : (WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGES['ur-PK']);
    setMessages([{ role: 'assistant', content: welcome }]);
    speakText(welcome);
  }

  async function handleLogout() {
    cancelSpeech();
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
      speakText(data.reply);
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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLanguage;
    setIsListening(true);
    recognition.onresult = (event) => {
      setIsListening(false);
      void handleSend(event.results[0][0].transcript);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
      setIsListening(false);
      toast.error('Could not recognize voice');
    };
    recognition.onend = () => setIsListening(false);
    try {
      recognition.start();
    } catch (error) {
      console.error('Could not start speech recognition:', error);
      setIsListening(false);
      toast.error('Could not start voice input');
    }
  }

  function toggleVoice() {
    if (voiceEnabled) {
      cancelSpeech();
      setIsSpeaking(false);
    }
    setVoiceEnabled(!voiceEnabled);
  }

  function handleTickerTap() {
    const conversation = document.getElementById('chat-conversation');
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: 'smooth' });
    document.getElementById('chat-input')?.focus({ preventScroll: true });
  }

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50 text-gray-500">Loading...</div>;
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 animate-float-slow rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-80 w-80 animate-float-slow rounded-full bg-teal-300/20 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 animate-float-slow rounded-full bg-cyan-300/10 blur-3xl [animation-delay:2s]" />
      </div>
      <Toaster position="top-center" />
      <header className="z-30 flex h-14 shrink-0 items-center justify-between bg-white/90 px-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-bold text-white">D</div>
          <h1 className="text-lg font-bold text-gray-800">Danyal Bhai</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <CharacterSelector current={character} onChange={handleCharacterChange} />
          <LanguageSelector current={currentLanguage} onChange={setCurrentLanguage} />
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceEnabled ? 'Turn voice off' : 'Turn voice on'}
            className="rounded-full bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100"
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
            <LogOut size={16} /><span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-[50vh] min-h-[292px] max-h-[420px] shrink-0 items-center justify-center overflow-hidden px-2 py-1 sm:px-4">
          <Avatar photoUrl={avatarPhoto} isSpeaking={isSpeaking} isListening={isListening} />
        </section>
        <TextTicker messages={messages} onTap={handleTickerTap} />
        <section className="min-h-0 flex-1 overflow-hidden border-t border-white/60 bg-white/40">
          <ChatInterface
            messages={messages}
            onSend={handleSend}
            onVoiceInput={handleVoiceInput}
            isListening={isListening}
            isLoading={isLoading}
          />
        </section>
      </main>
      {user && <span className="sr-only">Logged in as {user.email}</span>}
    </div>
  );
}
