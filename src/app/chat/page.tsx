'use client';

import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar/Avatar';
import ChatInterface from '@/components/Chat/ChatInterface';
import LanguageSelector from '@/components/Chat/LanguageSelector';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type Message = { role: 'user' | 'assistant'; content: string };
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
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

const URDU_WELCOME = 'السلام علیکم، میں آپ کا دانیال بھائی ہوں۔ کوئی مدد چاہیے تو پوچھ سکتے ہیں۔';
const ENGLISH_WELCOME = "Assalam-o-Alaikum! I'm your Danyal Bhai. If you need any help, feel free to ask.";

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [avatarPhoto] = useState('/avatar/avatar-photo.jpg');
  const [currentLanguage, setCurrentLanguage] = useState('ur-PK');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const hasWelcomed = useRef(false);
  const router = useRouter();

  function speakText(text: string, language = currentLanguage) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()) && /male/i.test(voice.name))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) router.replace('/login');
      else setUser(data.user);
      setLoading(false);
    });
    return () => {
      mounted = false;
      window.speechSynthesis?.cancel();
    };
  }, [router]);

  useEffect(() => {
    if (loading || !user || hasWelcomed.current) return;
    hasWelcomed.current = true;
    const welcomeText = currentLanguage === 'en-US' ? ENGLISH_WELCOME : URDU_WELCOME;
    setMessages([{ role: 'assistant', content: welcomeText }]);
    if (voiceEnabled) speakText(welcomeText, currentLanguage);
  }, [loading, user, currentLanguage, voiceEnabled]);

  async function handleLogout() {
    window.speechSynthesis?.cancel();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  async function handleSend(text: string) {
    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages, language: currentLanguage }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        return;
      }
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      speakText(data.reply, currentLanguage);
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
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setVoiceEnabled(!voiceEnabled);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50 text-gray-500">Loading...</div>;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-10 h-64 w-64 animate-float-slow rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-80 w-80 animate-float-slow rounded-full bg-teal-300/20 blur-3xl [animation-delay:1s]" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 animate-float-slow rounded-full bg-cyan-300/10 blur-3xl [animation-delay:2s]" />
      </div>
      <Toaster position="top-center" />
      <header className="z-30 flex h-16 shrink-0 items-center justify-between bg-white/90 px-3 shadow-sm backdrop-blur sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-bold text-white">D</div>
          <h1 className="text-lg font-bold text-gray-800">Danyal Bhai</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector current={currentLanguage} onChange={setCurrentLanguage} />
          <button type="button" onClick={toggleVoice} aria-label={voiceEnabled ? 'Turn voice off' : 'Turn voice on'} className="rounded-full bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100">
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"><LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span></button>
        </div>
      </header>
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-[60%] min-h-0 shrink-0 items-center justify-center overflow-hidden px-2 py-2 sm:px-4">
          <Avatar photoUrl={avatarPhoto} isSpeaking={isSpeaking} isListening={isListening} />
        </section>
        <section className="h-[40%] min-h-0 flex-1 overflow-hidden border-t border-white/60 bg-white/40">
          <ChatInterface messages={messages} onSend={handleSend} onVoiceInput={handleVoiceInput} isListening={isListening} isLoading={isLoading} />
        </section>
      </main>
      {user && <span className="sr-only">Logged in as {user.email}</span>}
    </div>
  );
}
