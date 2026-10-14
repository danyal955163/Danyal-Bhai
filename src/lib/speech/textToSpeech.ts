export interface SpeakOptions {
  text: string;
  language?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
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

function releaseAudio(audio: HTMLAudioElement, audioUrl: string) {
  audio.onplaying = null;
  audio.onended = null;
  audio.onerror = null;
  if (currentAudio === audio) currentAudio = null;
  if (currentAudioUrl === audioUrl) currentAudioUrl = null;
  URL.revokeObjectURL(audioUrl);
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;

  currentRequest?.abort();
  currentRequest = null;

  const audio = currentAudio;
  const audioUrl = currentAudioUrl;
  currentAudio = null;
  currentAudioUrl = null;
  if (audio) {
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (audioUrl) URL.revokeObjectURL(audioUrl);

  const source = currentSource;
  currentSource = null;
  if (source) {
    source.onended = null;
    try { source.stop(); } catch { /* Source may already have ended. */ }
    try { source.disconnect(); } catch { /* Already disconnected. */ }
  }
}

export async function speak({
  text,
  language = 'ur-PK',
  onStart,
  onEnd,
  onError,
}: SpeakOptions): Promise<void> {
  stopSpeaking();
  if (typeof window === 'undefined') return;

  // Unlock Web Audio immediately while the user's tap is still active. It remains
  // available as a fallback on mobile browsers that reject delayed HTMLAudio.play().
  const context = getAudioContext();
  const unlockPromise = context && context.state !== 'running'
    ? context.resume()
    : Promise.resolve();
  void unlockPromise.catch(() => undefined);

  const controller = new AbortController();
  currentRequest = controller;
  let audioUrl: string | null = null;
  let audio: HTMLAudioElement | null = null;
  let audioStarted = false;

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || `Edge-TTS request failed (${response.status})`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const audioData = await response.arrayBuffer();
    if (controller.signal.aborted) return;

    audioUrl = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));
    audio = new Audio(audioUrl);
    audio.preload = 'auto';
    currentAudio = audio;
    currentAudioUrl = audioUrl;

    audio.onplaying = () => {
      audioStarted = true;
      onStart?.();
    };
    audio.onended = () => {
      releaseAudio(audio!, audioUrl!);
      onEnd?.();
    };
    audio.onerror = () => {
      // Some mobile browsers signal an error before rejecting play(); defer to the
      // fallback attempt before reporting playback failure.
      if (audioStarted && audio && audioUrl) {
        releaseAudio(audio, audioUrl);
        onError?.(new Error('Audio playback error'));
      }
    };

    try {
      await audio.play();
      return;
    } catch (playError) {
      if (controller.signal.aborted) return;
      if (!context) throw playError;

      audio.pause();
      releaseAudio(audio, audioUrl);
      audio.removeAttribute('src');
      audio.load();
      audio = null;
      audioUrl = null;

      if (context.state !== 'running') await unlockPromise;
      if (context.state !== 'running') await context.resume();
      const audioBuffer = await context.decodeAudioData(audioData.slice(0));
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
    }
  } catch (error) {
    if (audio && audioUrl && currentAudio === audio) {
      audio.pause();
      releaseAudio(audio, audioUrl);
    }
    if (!isAbortError(error) && !controller.signal.aborted) {
      console.error('[TTS] Edge-TTS playback failed:', error);
      onError?.(error);
    }
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}
