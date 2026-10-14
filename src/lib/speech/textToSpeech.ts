export interface SpeakOptions {
  text: string;
  language?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
}

const ELEVENLABS_MALE_VOICES: Record<string, string> = {
  en: 'pNInz6obpgDQGcFmaJgB', // Adam
  ur: 'TxGEqnHWrfWFTfGW9XjX', // Josh
  hi: 'TxGEqnHWrfWFTfGW9XjX',
  ps: 'pNInz6obpgDQGcFmaJgB',
  ar: 'pNInz6obpgDQGcFmaJgB',
};

const WEB_MALE_VOICE_NAMES = [
  'david', 'mark', 'daniel', 'alex', 'fred', 'muhammad', 'mohammed',
  'arif', 'ravi', 'asad', 'male', 'man', 'hemant', 'rishi', 'khan',
];

let elevenLabsUnavailable = false;
let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let rejectCurrentAudio: ((reason?: unknown) => void) | null = null;
let currentRequest: AbortController | null = null;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function stopCurrentAudio() {
  currentRequest?.abort();
  currentRequest = null;
  if (!currentAudio) return;

  const audio = currentAudio;
  const audioUrl = currentAudioUrl;
  const reject = rejectCurrentAudio;
  currentAudio = null;
  currentAudioUrl = null;
  rejectCurrentAudio = null;
  audio.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  reject?.(new DOMException('Speech cancelled', 'AbortError'));
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
  stopCurrentAudio();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakWithWebSpeech({ text, language, onStart, onEnd, onError }: SpeakOptions) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('No speech synthesis is available in this browser'));
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const normalizedLanguage = language ?? 'ur-PK';
  const langCode = normalizedLanguage.split('-')[0].toLowerCase();
  utterance.lang = normalizedLanguage;
  utterance.rate = 0.9;
  utterance.pitch = 0.6;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const maleVoice = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(langCode)
    && WEB_MALE_VOICE_NAMES.some((name) => voice.name.toLowerCase().includes(name)),
  ) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(langCode));

  if (maleVoice) {
    utterance.voice = maleVoice;
    console.log('[TTS] Web Speech voice:', maleVoice.name, '| lang:', maleVoice.lang);
  }
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (event) => onError?.(event);
  window.speechSynthesis.speak(utterance);
}

async function speakWithElevenLabs({ text, language = 'ur-PK', onStart, onEnd }: SpeakOptions) {
  const langCode = language.split('-')[0].toLowerCase();
  const voiceId = ELEVENLABS_MALE_VOICES[langCode] ?? ELEVENLABS_MALE_VOICES.en;
  const controller = new AbortController();
  currentRequest?.abort();
  currentRequest = controller;

  let audioUrl: string | null = null;
  try {
    console.log('[TTS] Trying ElevenLabs male voice:', voiceId);
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'ElevenLabs TTS request failed') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    audioUrl = URL.createObjectURL(await response.blob());
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    currentAudioUrl = audioUrl;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        if (currentAudio === audio) {
          currentAudio = null;
          currentAudioUrl = null;
          rejectCurrentAudio = null;
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };

      rejectCurrentAudio = reject;
      audio.onplay = () => onStart?.();
      audio.onended = () => {
        cleanup();
        onEnd?.();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error('Audio playback failed'));
      };
      void audio.play().catch((error: unknown) => {
        cleanup();
        reject(error);
      });
    });
  } catch (error) {
    if (audioUrl && currentAudioUrl !== audioUrl) URL.revokeObjectURL(audioUrl);
    throw error;
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}

export async function speak(options: SpeakOptions): Promise<void> {
  stopSpeaking();
  if (typeof window === 'undefined') return;

  if (!elevenLabsUnavailable) {
    try {
      await speakWithElevenLabs(options);
      return;
    } catch (error) {
      if (isAbortError(error)) return;
      if ((error as { status?: number } | null)?.status === 503) elevenLabsUnavailable = true;
      console.warn('[TTS] ElevenLabs unavailable; using Web Speech fallback');
    }
  }

  speakWithWebSpeech(options);
}
