export type SpeakOptions = {
  text: string;
  language?: string;
  pitch?: number;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
};

type ElevenLabsOptions = SpeakOptions & { voiceId?: string };

const maleVoicePatterns: Record<string, string[]> = {
  ur: ['muhammad', 'mohammed', 'arif', 'ravi', 'asad', 'male', 'man'],
  en: ['david', 'mark', 'daniel', 'male', 'alex', 'fred'],
  ps: ['male', 'man', 'khan'],
  ar: ['hamed', 'maged', 'male'],
  hi: ['madhur', 'ravi', 'male'],
};

let elevenLabsUnavailable = false;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let rejectActiveAudio: ((reason?: unknown) => void) | null = null;
let activeRequest: AbortController | null = null;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function voiceForLanguage(language: string, voices: SpeechSynthesisVoice[]) {
  const langCode = language.split('-')[0].toLowerCase();
  const patterns = maleVoicePatterns[langCode] ?? ['male', 'man'];
  return voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(langCode)
    && patterns.some((pattern) => voice.name.toLowerCase().includes(pattern)),
  ) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(langCode));
}

export function cancelSpeech() {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  activeRequest?.abort();
  activeRequest = null;

  if (activeAudio) {
    const audio = activeAudio;
    const audioUrl = activeAudioUrl;
    const reject = rejectActiveAudio;
    activeAudio = null;
    activeAudioUrl = null;
    rejectActiveAudio = null;
    audio.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    reject?.(new DOMException('Speech cancelled', 'AbortError'));
  }
}

export function speak({
  text,
  language = 'ur-PK',
  rate = 0.9,
  onStart,
  onEnd,
  onError,
}: SpeakOptions) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('Speech synthesis is not supported in this browser'));
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = rate;
  utterance.pitch = 0.7;
  utterance.volume = 1;

  const selectedVoice = voiceForLanguage(language, window.speechSynthesis.getVoices());
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    console.log('[Speech] Using voice:', selectedVoice.name, '| lang:', selectedVoice.lang);
  }

  utterance.onstart = onStart ?? null;
  utterance.onend = onEnd ?? null;
  utterance.onerror = (event) => onError?.(event);
  window.speechSynthesis.speak(utterance);
}

export async function speakWithElevenLabs({
  text,
  voiceId = 'pNInz6obpgDQGcFmaJgB',
  onStart,
  onEnd,
}: ElevenLabsOptions) {
  if (typeof window === 'undefined') throw new Error('Audio playback is unavailable');

  const controller = new AbortController();
  activeRequest?.abort();
  activeRequest = controller;
  let audioUrl: string | null = null;

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'ElevenLabs TTS request failed') as Error & { status?: number; code?: string };
      error.status = response.status;
      error.code = data.code;
      throw error;
    }

    const audioBlob = await response.blob();
    audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    activeAudio = audio;
    activeAudioUrl = audioUrl;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        if (activeAudio === audio) {
          activeAudio = null;
          activeAudioUrl = null;
          rejectActiveAudio = null;
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };

      rejectActiveAudio = reject;
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
    if (audioUrl && activeAudioUrl !== audioUrl) URL.revokeObjectURL(audioUrl);
    throw error;
  } finally {
    if (activeRequest === controller) activeRequest = null;
  }
}

export async function speakWithFallback(options: SpeakOptions) {
  if (typeof window === 'undefined') return;
  cancelSpeech();

  if (!elevenLabsUnavailable) {
    try {
      await speakWithElevenLabs({ ...options, onError: undefined });
      return;
    } catch (error) {
      if (isAbortError(error)) return;
      const status = (error as { status?: number } | null)?.status;
      if (status === 503) elevenLabsUnavailable = true;
    }
  }

  speak(options);
}
