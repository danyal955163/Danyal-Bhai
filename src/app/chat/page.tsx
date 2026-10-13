'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar/Avatar';
import ChatInterface from '@/components/Chat/ChatInterface';
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

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const welcomeMessage = 'السلام علیکم! میں دانیال بھائی ہوں، آپ کی کیا مدد کر سکتا ہوں؟';

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const router = useRouter();

  function speakText(text: string, language = 'ur-PK') {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.95;
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
      if (!data.user) {
        router.replace('/login');
      } else {
        setUser(data.user);
        setMessages([{ role: 'assistant', content: welcomeMessage }]);
        window.setTimeout(() => speakText(welcomeMessage), 250);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      window.speechSynthesis?.cancel();
    };
  }, [router]);

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
        body: JSON.stringify({
          message: text,
          history: messages,
          language: navigator.language,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      speakText(data.reply, navigator.language || 'ur-PK');
    } catch (error) {
      console.error('Chat request failed:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }

  function handleVoiceInput() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ur-PK';
    setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      void handleSend(transcript);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-100 to-blue-50 text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-100 to-blue-50">
      <Toaster position="top-center" />
      <header className="flex h-16 shrink-0 items-center justify-between bg-white px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-bold text-white">D</div>
          <h1 className="text-lg font-bold text-gray-800">Danyal Bhai</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-[60%] min-h-0 shrink-0 items-center justify-center overflow-hidden px-2 py-2 sm:px-4">
          <Avatar photoUrl="/danyal-avatar.svg" isSpeaking={isSpeaking} isListening={isListening} />
        </section>
        <section className="h-[40%] min-h-0 flex-1 overflow-hidden border-t border-white/60 bg-white/40">
          <ChatInterface messages={messages} onSend={handleSend} onVoiceInput={handleVoiceInput} isListening={isListening} isLoading={isLoading} />
        </section>
      </main>
      {user && <span className="sr-only">Logged in as {user.email}</span>}
    </div>
  );
}
