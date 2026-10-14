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
  hi: 'TxGEqnHWrfWFTfGW9XjX', // Josh
  ps: 'pNInz6obpgDQGcFmaJgB', // Adam
  ar: 'pNInz6obpgDQGcFmaJgB', // Adam
  fa: 'pNInz6obpgDQGcFmaJgB', // Adam
};

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let rejectCurrentAudio: ((reason?: unknown) => void) | null = null;
let currentRequest: AbortController | null = null;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
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
  audio.src = '';
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  reject?.(new DOMException('Speech cancelled', 'AbortError'));
}

export async function speak({ text, language = 'ur-PK', onStart, onEnd, onError }: SpeakOptions): Promise<void> {
  stopSpeaking();
  if (typeof window === 'undefined') return;

  const langCode = language.split('-')[0].toLowerCase();
  const voiceId = ELEVENLABS_MALE_VOICES[langCode] ?? ELEVENLABS_MALE_VOICES.en;
  const controller = new AbortController();
  currentRequest = controller;
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
      throw new Error(data.error || 'ElevenLabs speech synthesis failed');
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
    if (!isAbortError(error)) {
      console.error('[TTS] ElevenLabs male voice failed:', error);
      onError?.(error);
    }
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}
