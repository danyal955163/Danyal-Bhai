'use client';

import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import CameraStudio, { type CameraCommand } from '@/components/Chat/CameraStudio';
import ChatSidebar from '@/components/Chat/ChatSidebar';
import TextMode from '@/components/Chat/TextMode';
import VoiceDashboard from '@/components/Chat/VoiceDashboard';
import WelcomeScreen from '@/components/Chat/WelcomeScreen';
import { isBackgroundAudioEnabled } from '@/lib/audioSession';
import { loadPreferences, savePreferences, type AppPreferences, type NoiseFilterLevel } from '@/lib/preferences';
import { createSpeechRecognition, type SpeechRecognitionInstance } from '@/lib/speech/speechToText';
import { speak, stopSpeaking } from '@/lib/speech/textToSpeech';
import { VoiceActivityDetector } from '@/lib/speech/voiceActivityDetector';
import { createClient } from '@/lib/supabase/client';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; imageUrls?: string[] };
type ChatMode = 'welcome' | 'voice' | 'text';

const WELCOME_MESSAGE = 'السلام علیکم، میں می اے آئی ہوں۔ آپ کیسے ہیں؟ میں آپ کی کس طرح مدد کر سکتا ہوں؟';
const WELCOME_MESSAGES: Record<string, string> = {
  'ur-PK': WELCOME_MESSAGE,
  'en-US': 'Hello, how can I help you today?',
  'ps-AF': 'السلام علیکم، څنګه مرسته درسره کولی شم؟',
};
const WELCOME_CONTENTS = new Set(Object.values(WELCOME_MESSAGES));
const CHAT_SESSION_KEY = 'me-ai.active-chat.v1';
const CHAT_SESSION_ENDED_KEY = 'me-ai.active-chat-ended';
const MIC_PERMISSION_KEY = 'mic_permission';

function detectMessageLanguage(text: string, preferredLanguage: string): string {
  if (!text.trim()) return preferredLanguage;
  if (!/[\u0600-\u06FF]/u.test(text)) return 'en-US';
  if (/[ټډړځڅښږڼګ]/u.test(text) || preferredLanguage === 'ps-AF') return 'ps-AF';
  return 'ur-PK';
}

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
  const [micLevel, setMicLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const [mode, setMode] = useState<ChatMode>('welcome');
  const [sessionReady, setSessionReady] = useState(false);
  const [avatarPhoto] = useState('/avatar/me-ai-owner.png');
  const [currentLanguage, setCurrentLanguage] = useState('ur-PK');
  const [uiLanguage, setUiLanguage] = useState('en-US');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [noiseFilterLevel, setNoiseFilterLevel] = useState<NoiseFilterLevel>('medium');
  const [imagePickerPending, setImagePickerPending] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const [character, setCharacter] = useState('danyal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionRestoreAttemptedRef = useRef(false);
  const cameraOpenRef = useRef(false);
  const cameraCommandIdRef = useRef(0);
  const messageImageUrlsRef = useRef(new Set<string>());
  const welcomeShownRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const isLoadingRef = useRef(false);
  const micPermissionBlockedRef = useRef(false);
  const micPermissionNoticeShownRef = useRef(false);
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
  const modeRef = useRef<ChatMode>('welcome');
  const isSpeakingRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const autoListenEnabledRef = useRef(true);
  const voiceToneRef = useRef<AppPreferences['voiceTone']>('deep');
  const spokenTextRef = useRef('');
  const chatGenerationRef = useRef(0);
  const router = useRouter();

  function updateIsSpeaking(value: boolean) {
    isSpeakingRef.current = value;
    setIsSpeakingState(value);
    if (value) setMicLevel(0);
    else setAiLevel(0);
  }

  function applyPreferences(preferences: AppPreferences) {
    setCurrentLanguage(preferences.language);
    setUiLanguage(preferences.uiLanguage);
    setVoiceEnabled(preferences.voiceEnabled);
    setNoiseFilterLevel(preferences.noiseFilterLevel);
    voiceToneRef.current = preferences.voiceTone;
    voiceEnabledRef.current = preferences.voiceEnabled;
    autoListenEnabledRef.current = preferences.autoListen;
    currentLanguageRef.current = preferences.language;
    if (recognitionRef.current) recognitionRef.current.lang = preferences.language;
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    try {
      const permission = window.localStorage.getItem(MIC_PERMISSION_KEY);
      if (permission === 'granted' || permission === 'denied') {
        console.info('[Mic] Permission status previously observed:', permission);
        micPermissionBlockedRef.current = permission === 'denied';
      }
    } catch { /* Browser storage is optional; browser permissions remain authoritative. */ }
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
      setMicLevel(0);
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
    void detector.start(
      () => { lastVadVoiceAtRef.current = Date.now(); },
      (level) => { if (!isSpeakingRef.current) setMicLevel(level); },
    ).then((started) => {
      if (!cancelled && vadRef.current === detector) {
        vadReadyRef.current = started;
        if (started) {
          micPermissionBlockedRef.current = false;
          micPermissionNoticeShownRef.current = false;
          try { window.localStorage.setItem(MIC_PERMISSION_KEY, 'granted'); } catch { /* Browser storage is optional. */ }
        }
      }
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

  function revokeMessageImageUrls() {
    messageImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    messageImageUrlsRef.current.clear();
  }

  function scheduleAutoListen() {
    cancelAutoListen();
    if (micPermissionBlockedRef.current || (listenRequestedRef.current && recognitionRef.current)) return;
    autoListenTimerRef.current = window.setTimeout(() => {
      autoListenTimerRef.current = null;
      if (modeRef.current === 'voice' && (autoListenEnabledRef.current || cameraOpenRef.current)) startVoiceRecognition(false);
    }, 600);
  }

  function scheduleSilenceSubmission() {
    cancelSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      const fullText = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, ' ').trim();
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      if (fullText.length <= 1 || isLoadingRef.current) return;
      if (runCameraVoiceCommand(fullText)) return;

      const recognition = recognitionRef.current;
      listenRequestedRef.current = false;
      interruptMonitorRef.current = false;
      cancelInterruptRetry();
      if (recognition) {
        try { recognition.stop(); } catch { /* Recognition may already be ending. */ }
      }
      setIsListening(false);
      setMicLevel(0);
      void handleSend(fullText, [], currentLanguageRef.current);
    }, 2_000);
  }

  function speakText(text: string, autoListen = false, language = currentLanguageRef.current) {
    if (modeRef.current !== 'voice') return;
    spokenTextRef.current = text;
    if (!voiceEnabledRef.current) {
      updateIsSpeaking(false);
      if (!listenRequestedRef.current && ((autoListen && autoListenEnabledRef.current) || cameraOpenRef.current)) scheduleAutoListen();
      return;
    }
    cancelAutoListen();
    cancelInterruptRetry();
    void speak({
      text,
      language,
      voiceTone: voiceToneRef.current,
      onLevel: setAiLevel,
      onStart: () => {
        updateIsSpeaking(true);
      },
      onEnd: () => {
        updateIsSpeaking(false);
        spokenTextRef.current = '';
        interruptMonitorRef.current = false;
        if (!listenRequestedRef.current && ((autoListen && autoListenEnabledRef.current) || cameraOpenRef.current)) scheduleAutoListen();
      },
      onError: (error) => {
        updateIsSpeaking(false);
        spokenTextRef.current = '';
        interruptMonitorRef.current = false;
        console.error('Edge-TTS voice is unavailable:', error);
        const audioUnavailableMessage = language === 'ur-PK'
          ? 'معذرت، آواز فی الحال دستیاب نہیں۔ جواب متن میں موجود ہے؛ دوبارہ کوشش کریں۔'
          : language === 'ps-AF'
            ? 'بښنه، غږ اوس مهال شتون نه لري. ځواب په متن کې شته؛ بیا هڅه وکړئ.'
            : 'Sorry, audio is temporarily unavailable. The reply is still here in text; please try again.';
        toast.error(audioUnavailableMessage);
        if (!listenRequestedRef.current && ((autoListen && autoListenEnabledRef.current) || cameraOpenRef.current)) scheduleAutoListen();
      },
    });
  }

  function createFreshChat(options?: { greet?: boolean; mode?: ChatMode; notify?: boolean }) {
    chatGenerationRef.current += 1;
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    revokeMessageImageUrls();
    updateIsSpeaking(false);
    setIsListening(false);
    isLoadingRef.current = false;
    setIsLoading(false);
    conversationIdRef.current = null;
    setCurrentConversationId(null);

    const nextMode = options?.mode ?? modeRef.current;
    modeRef.current = nextMode;
    setMode(nextMode);
    const greeting = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
    setMessages(options?.greet && nextMode !== 'welcome' ? [{ role: 'assistant', content: greeting }] : []);

    if (options?.greet && nextMode === 'voice') speakText(greeting, true);
    if (options?.notify) toast.success('نیا چیٹ شروع ہو گیا');
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
    cancelAutoListen();
    cancelInterruptRetry();
    cancelSilenceTimer();
    stopSpeaking();
    stopVoiceRecognition();
    revokeMessageImageUrls();
    updateIsSpeaking(false);
    setIsListening(false);
    isLoadingRef.current = true;
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
      modeRef.current = 'text';
      setMode('text');
    } catch (error) {
      if (generation !== chatGenerationRef.current) return;
      console.error('Could not open conversation:', error);
      toast.error('Could not open this chat');
    } finally {
      if (generation === chatGenerationRef.current) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
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
      stopSpeaking();
      listenRequestedRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      vadRef.current?.stop();
      vadRef.current = null;
      revokeMessageImageUrls();
    };
  }, [router]);

  useEffect(() => {
    if (!user || sessionRestoreAttemptedRef.current) return;
    sessionRestoreAttemptedRef.current = true;
    try {
      const sessionEnded = window.sessionStorage.getItem(CHAT_SESSION_ENDED_KEY) === '1';
      const raw = window.sessionStorage.getItem(CHAT_SESSION_KEY);
      window.sessionStorage.removeItem(CHAT_SESSION_ENDED_KEY);
      if (sessionEnded) {
        window.sessionStorage.removeItem(CHAT_SESSION_KEY);
      } else if (raw) {
        const saved = JSON.parse(raw) as { userId?: unknown; messages?: unknown; conversationId?: unknown; mode?: unknown };
        if (saved.userId === user.id && Array.isArray(saved.messages)) {
          const restored = saved.messages
            .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
              typeof item === 'object' && item !== null &&
              ((item as { role?: unknown }).role === 'user' || (item as { role?: unknown }).role === 'assistant') &&
              typeof (item as { content?: unknown }).content === 'string',
            )
            .slice(-100)
            .map((item) => ({ role: item.role, content: item.content }));
          if (restored.length) {
            welcomeShownRef.current = true;
            messagesRef.current = restored;
            setMessages(restored);
          }
          if (typeof saved.conversationId === 'string') {
            conversationIdRef.current = saved.conversationId;
            setCurrentConversationId(saved.conversationId);
          }
          const restoredMode: ChatMode = saved.mode === 'voice' || saved.mode === 'text' ? saved.mode : 'welcome';
          modeRef.current = restoredMode;
          setMode(restoredMode);
        } else {
          window.sessionStorage.removeItem(CHAT_SESSION_KEY);
        }
      }
    } catch (error) {
      console.warn('Could not restore the active chat session:', error);
      window.sessionStorage.removeItem(CHAT_SESSION_KEY);
    }
    setSessionReady(true);
  }, [user]);

  useEffect(() => {
    if (!user || !sessionReady) return;
    try {
      window.sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify({
        userId: user.id,
        conversationId: currentConversationId,
        mode,
        language: currentLanguage,
        messages: messages.slice(-60).map(({ role, content }) => ({ role, content: content.slice(0, 12_000) })),
      }));
    } catch (error) {
      console.info('The active chat could not be stored for this tab:', error);
    }
  }, [currentConversationId, currentLanguage, messages, mode, sessionReady, user]);

  useEffect(() => {
    if (!user) return;
    const markSessionEnded = () => {
      try { window.sessionStorage.setItem(CHAT_SESSION_ENDED_KEY, '1'); } catch { /* Storage can be disabled. */ }
    };
    const startFreshAfterReturn = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.sessionStorage.removeItem(CHAT_SESSION_ENDED_KEY);
      window.sessionStorage.removeItem(CHAT_SESSION_KEY);
      createFreshChat({ greet: true, mode: 'welcome' });
    };
    window.addEventListener('pagehide', markSessionEnded);
    window.addEventListener('pageshow', startFreshAfterReturn);
    return () => {
      window.removeEventListener('pagehide', markSessionEnded);
      window.removeEventListener('pageshow', startFreshAfterReturn);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !sessionReady || modeRef.current === 'welcome' || welcomeShownRef.current || messages.length > 0) return;
    welcomeShownRef.current = true;
    const greeting = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
    setMessages([{ role: 'assistant', content: greeting }]);
    if (modeRef.current === 'voice') speakText(greeting, true, currentLanguage);
  }, [user, sessionReady, messages.length, currentLanguage]);

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
    micPermissionBlockedRef.current = false;
    startVoiceRecognition(false);
    if (messages.length === 0) {
      const welcome = WELCOME_MESSAGES[currentLanguage] ?? WELCOME_MESSAGE;
      setMessages([{ role: 'assistant', content: welcome }]);
      speakText(welcome, true);
    }
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
    if (recognitionRef.current) recognitionRef.current.lang = language;
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
    cancelAutoListen();
    cancelInterruptRetry();
    stopSpeaking();
    stopVoiceRecognition();
    try {
      window.sessionStorage.removeItem(CHAT_SESSION_KEY);
      window.sessionStorage.removeItem(CHAT_SESSION_ENDED_KEY);
    } catch { /* Storage may be disabled by the browser. */ }
    await createClient().auth.signOut();
    router.replace('/login');
  }

  async function handleSend(text: string, images: File[] = [], languageOverride?: string) {
    if (isLoadingRef.current) return;
    const generation = chatGenerationRef.current;
    const cleanedText = text.trim();
    const requestLanguage = languageOverride ?? detectMessageLanguage(cleanedText, currentLanguageRef.current);
    if (requestLanguage !== currentLanguageRef.current) changeLanguage(requestLanguage);
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
    isLoadingRef.current = true;
    setIsLoading(true);

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
          languageLocked: Boolean(languageOverride),
          character: characterRef.current,
          images: imageDataUrls,
        }),
      });
      const data = await response.json();
      if (generation !== chatGenerationRef.current) return;
      if (!response.ok || !data.reply) {
        toast.error(data.error ?? 'Failed to get a response');
        if (modeRef.current === 'voice' && (autoListenEnabledRef.current || cameraOpenRef.current)) scheduleAutoListen();
        return;
      }
      const assistantMessage: Message = { role: 'assistant', content: data.reply };
      setMessages((existing) => [...existing, assistantMessage]);
      if (user && conversationId) await saveMessage(user.id, conversationId, 'assistant', data.reply, requestLanguage);
      if (modeRef.current === 'voice') speakText(data.reply, true, requestLanguage);
    } catch (error) {
      console.error('Chat request failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      if (modeRef.current === 'voice' && (autoListenEnabledRef.current || cameraOpenRef.current)) scheduleAutoListen();
    } finally {
      if (generation === chatGenerationRef.current) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
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
    setMicLevel(0);
    if (updateUi) setIsListening(false);
  }

  function startVoiceRecognition(interruptOnly: boolean, resetTranscript = true) {
    if (recognitionRef.current) {
      if (interruptOnly) {
        interruptMonitorRef.current = true;
      } else {
        interruptMonitorRef.current = false;
        if (resetTranscript) {
          finalTranscriptRef.current = '';
          interimTranscriptRef.current = '';
        }
      }
      return;
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
      if (!listenRequestedRef.current || isLoadingRef.current) return;
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
          spokenTextRef.current = '';
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
      if (acceptedSpeech) {
        micPermissionBlockedRef.current = false;
        micPermissionNoticeShownRef.current = false;
        try { window.localStorage.setItem(MIC_PERMISSION_KEY, 'granted'); } catch { /* Browser storage is optional. */ }
        scheduleSilenceSubmission();
      }
    };

    recognition.onerror = (event) => {
      const code = typeof event === 'object' && event !== null && 'error' in event
        ? String((event as { error: unknown }).error)
        : 'unknown';
      console.info('[Speech recognition] Recognition ended:', code);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        listenRequestedRef.current = false;
        micPermissionBlockedRef.current = true;
        cancelSilenceTimer();
        vadRef.current?.stop();
        vadRef.current = null;
        vadReadyRef.current = false;
        setIsListening(false);
        setMicLevel(0);
        try { window.localStorage.setItem(MIC_PERMISSION_KEY, 'denied'); } catch { /* Browser storage is optional. */ }
        if (!micPermissionNoticeShownRef.current) {
          micPermissionNoticeShownRef.current = true;
          toast.error('Microphone permission is required for voice input. Allow it in browser settings, then tap the microphone again.');
        }
      } else if (code !== 'no-speech' && code !== 'aborted') {
        toast.error('Could not recognize voice. Check microphone permission.');
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!listenRequestedRef.current || modeRef.current !== 'voice') {
        setIsListening(false);
        setMicLevel(0);
        return;
      }
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
      setMicLevel(0);
      if (!interruptOnly) toast.error('Could not start voice input');
    }
  }

  function handleVoiceInput() {
    if (isSpeakingRef.current) return;
    cancelAutoListen();
    cancelInterruptRetry();
    if (recognitionRef.current) {
      stopVoiceRecognition();
      return;
    }
    micPermissionBlockedRef.current = false;
    startVoiceRecognition(false);
  }

  function openCamera() {
    stopSpeaking();
    updateIsSpeaking(false);
    spokenTextRef.current = '';
    interruptMonitorRef.current = false;
    cameraOpenRef.current = true;
    setCameraOpen(true);
    if (modeRef.current === 'voice' && !listenRequestedRef.current) startVoiceRecognition(false);
  }

  function closeCamera() {
    cameraOpenRef.current = false;
    setCameraOpen(false);
  }

  function runCameraVoiceCommand(text: string) {
    const normalized = text.normalize('NFC').toLocaleLowerCase();
    const stop = /\b(?:stop|finish|end|off|turn off|switch off)(?:\s+(?:the\s+)?(?:camera|video|recording))?\b|\b(?:camera|video|recording)\s+(?:off|stop)\b|(?:ویڈیو|ویډیو|ریکارڈنگ|ریکارډ|کیمرہ|کیمرا|ثبت).{0,28}(?:بند|ختم|روک|ودرول|بنده|کړه|آف|اف)|(?:بند کرو|بند کریں|آف کرو|آف کریں|روک دو|ختم کرو|بنده کړه|چالان بند کړه)/iu.test(normalized);
    const photo = /\b(?:take|capture|snap)\b.{0,32}\b(?:photo|picture|pic|selfie)\b|\b(?:photo|picture|pic|selfie)\b.{0,24}\b(?:take|capture|click)\b|(?:تصویر|فوٹو|عکس|انځور|پکچر).{0,28}(?:کھینچ|لے|لیں|لو|واخله|واخلئ|اخستل|کش|کرو|کریں)|(?:کھینچو|کینچو).{0,20}(?:تصویر|فوٹو|پکچر|عکس)/iu.test(normalized);
    const record = /\b(?:start|begin|record|on|turn on|switch on)\b(?:\s+(?:the\s+)?(?:video|camera|recording))?\b|\b(?:video|camera)\s+(?:on|start|record)\b|(?:ویڈیو|ویډیو|ریکارڈنگ|ریکارډ|کیمرہ|کیمرا|ثبت).{0,28}(?:شروع|پیل|ریکارڈ|بنا|بناؤ|کرو|کر دو|چالو|آن|ان|وکړه|چالان)|(?:شروع کرو|شروع کریں|آن کرو|ان کرو|چالو کرو|چالان کړه)/iu.test(normalized);
    const action: CameraCommand['action'] | null = stop ? 'stop' : photo ? 'photo' : record ? 'record' : null;
    if (!action) return false;

    if (!cameraOpenRef.current) {
      toast.error(currentLanguageRef.current === 'ur-PK'
        ? 'پہلے Camera بٹن دبائیں اور اجازت دیں، پھر تصویر یا ویڈیو کا voice command دیں۔'
        : currentLanguageRef.current === 'ps-AF'
          ? 'لومړی د کامرې تڼۍ کېکاږئ او اجازه ورکړئ، بیا غږیز امر ووایئ.'
          : 'Tap Camera and allow access first, then give the photo/video voice command.');
      return true;
    }

    cameraCommandIdRef.current += 1;
    setCameraCommand({ id: cameraCommandIdRef.current, action });
    return true;
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
      <CameraStudio open={cameraOpen} onClose={closeCamera} language={uiLanguage} command={cameraCommand} />
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentConversationId={currentConversationId}
        language={uiLanguage}
        onNewChat={handleNewChat}
        onSelectConversation={(id, language) => { void loadConversation(id, language); }}
      />
      {mode === 'welcome' ? (
        <WelcomeScreen
          language={uiLanguage}
          onVoiceMode={enterVoiceMode}
          onTextMode={enterTextMode}
          onOpenHistory={() => setSidebarOpen(true)}
          onSettings={() => router.push('/settings')}
        />
      ) : mode === 'voice' ? (
        <VoiceDashboard
          uiLanguage={uiLanguage}
          photoUrl={avatarPhoto}
          isSpeaking={isSpeaking}
          isListening={isListening}
          micLevel={micLevel}
          aiLevel={aiLevel}
          isLoading={isLoading}
          statusText={uiLanguage === 'ur-PK'
            ? isLoading ? 'جواب تیار ہو رہا ہے…' : isSpeaking && isListening ? 'بول رہا ہوں · آپ کی بات سن رہا ہوں' : isSpeaking ? 'بول رہا ہوں…' : isListening ? 'سن رہا ہوں…' : 'تیار ہوں — بات شروع کریں'
            : uiLanguage === 'ps-AF'
              ? isLoading ? 'ځواب چمتو کېږي…' : isSpeaking && isListening ? 'خبرې کوم · ستاسو غږ اورم' : isSpeaking ? 'خبرې کوم…' : isListening ? 'اورم…' : 'چمتو یم — خبرې پیل کړئ'
              : isLoading ? 'Thinking…' : isSpeaking && isListening ? 'Speaking · listening for interruption' : isSpeaking ? 'Speaking…' : isListening ? 'Listening…' : 'Ready — tap to talk'}
          voiceEnabled={voiceEnabled}
          character={character}
          onCharacterChange={handleCharacterChange}
          onVoiceInput={handleVoiceInput}
          onOpenHistory={() => setSidebarOpen(true)}
          onSettings={() => router.push('/settings')}
          onTextMode={enterTextMode}
          onImageMode={enterImageMode}
          onCamera={openCamera}
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
          uiLanguage={uiLanguage}
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
