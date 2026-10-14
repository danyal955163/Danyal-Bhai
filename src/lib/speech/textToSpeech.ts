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

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let currentContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentRequest: AbortController | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as AudioWindow;
  const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) return null;
  currentContext ??= new AudioContextClass();
  return currentContext;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
  currentRequest?.abort();
  currentRequest = null;
  const source = currentSource;
  currentSource = null;
  if (source) {
    source.onended = null;
    try { source.stop(); } catch { /* Source may already have ended. */ }
    try { source.disconnect(); } catch { /* Already disconnected. */ }
  }
}

export async function speak({ text, language = 'ur-PK', onStart, onEnd, onError }: SpeakOptions): Promise<void> {
  stopSpeaking();
  if (typeof window === 'undefined') return;

  // Resume synchronously, before the network request, while a user's tap is still active.
  // This is important on mobile Safari/Chrome, where HTMLAudio.play() after fetch is
  // often rejected by autoplay policy even though the user tapped the voice-mode button.
  const context = getAudioContext();
  const unlockPromise = context && context.state !== 'running'
    ? context.resume()
    : Promise.resolve();
  void unlockPromise.catch(() => undefined);

  const langCode = language.split('-')[0].toLowerCase();
  const voiceId = ELEVENLABS_MALE_VOICES[langCode] ?? ELEVENLABS_MALE_VOICES.en;
  const controller = new AbortController();
  currentRequest = controller;

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'ElevenLabs speech synthesis failed') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const audioData = await response.arrayBuffer();
    if (controller.signal.aborted) return;

    if (!context) {
      throw new Error('This browser does not support audio playback');
    }
    if (context.state !== 'running') await unlockPromise;
    if (context.state !== 'running') await context.resume();

    const audioBuffer = await context.decodeAudioData(audioData);
    if (controller.signal.aborted) return;

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    currentSource = source;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (currentSource === source) currentSource = null;
        try { source.disconnect(); } catch { /* Already disconnected. */ }
        if (!controller.signal.aborted) onEnd?.();
        resolve();
      };
      onStart?.();
      source.start();
    });
  } catch (error) {
    if (!isAbortError(error)) {
      console.error('[TTS] ElevenLabs male voice playback failed:', error);
      onError?.(error);
    }
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}
