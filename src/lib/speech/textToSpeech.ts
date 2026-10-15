export interface SpeakOptions {
  text: string;
  language?: string;
  voiceTone?: 'deep' | 'natural';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error?: unknown) => void;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const MAX_TTS_CHUNK_LENGTH = 200;

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

function splitSpeechText(text: string): string[] {
  const normalizedText = text.trim();
  if (!normalizedText) return [];
  if (normalizedText.length <= MAX_TTS_CHUNK_LENGTH) return [normalizedText];

  const sentences = normalizedText.match(/[^.!?؟۔]+[.!?؟۔]+|[^.!?؟۔]+$/gu) ?? [normalizedText];
  const chunks: string[] = [];
  let currentChunk = '';
  const flush = () => {
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    currentChunk = '';
  };

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if (trimmedSentence.length <= MAX_TTS_CHUNK_LENGTH) {
      if (currentChunk && currentChunk.length + 1 + trimmedSentence.length > MAX_TTS_CHUNK_LENGTH) flush();
      currentChunk = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
      continue;
    }

    flush();
    for (const word of trimmedSentence.split(/\s+/u)) {
      if (word.length <= MAX_TTS_CHUNK_LENGTH) {
        if (currentChunk && currentChunk.length + 1 + word.length > MAX_TTS_CHUNK_LENGTH) flush();
        currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
        continue;
      }

      flush();
      const characters = Array.from(word);
      for (let index = 0; index < characters.length; index += MAX_TTS_CHUNK_LENGTH) {
        const part = characters.slice(index, index + MAX_TTS_CHUNK_LENGTH).join('');
        if (index + MAX_TTS_CHUNK_LENGTH < characters.length) chunks.push(part);
        else currentChunk = part;
      }
    }
  }

  flush();
  return chunks;
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

  const request = currentRequest;
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

  request?.abort();
}

export async function speak({
  text,
  language = 'ur-PK',
  voiceTone = 'deep',
  onStart,
  onEnd,
  onError,
}: SpeakOptions): Promise<void> {
  stopSpeaking();
  if (typeof window === 'undefined') return;

  const chunks = splitSpeechText(text);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }

  // Unlock Web Audio immediately while the user's tap is still active. It remains
  // available as a fallback on mobile browsers that reject delayed HTMLAudio.play().
  const context = getAudioContext();
  const unlockPromise = context && context.state !== 'running'
    ? context.resume()
    : Promise.resolve();
  void unlockPromise.catch(() => undefined);

  const controller = new AbortController();
  currentRequest = controller;
  let hasNotifiedStart = false;
  const notifyStart = () => {
    if (hasNotifiedStart) return;
    hasNotifiedStart = true;
    onStart?.();
  };

  try {
    for (const chunk of chunks) {
      if (controller.signal.aborted) return;

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk, language, voiceTone }),
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

      let audioUrl: string | null = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));
      let audio: HTMLAudioElement | null = new Audio(audioUrl);
      let htmlAudioStarted = false;
      audio.preload = 'auto';
      currentAudio = audio;
      currentAudioUrl = audioUrl;

      try {
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            controller.signal.removeEventListener('abort', handleAbort);
            if (audio && audioUrl) releaseAudio(audio, audioUrl);
            if (error) reject(error);
            else resolve();
          };
          const handleAbort = () => finish();

          audio!.onplaying = () => {
            htmlAudioStarted = true;
            notifyStart();
          };
          audio!.onended = () => finish();
          audio!.onerror = () => finish(new Error('Audio playback error'));
          controller.signal.addEventListener('abort', handleAbort, { once: true });
          if (controller.signal.aborted) {
            handleAbort();
            return;
          }
          void audio!.play().catch((error) => finish(error));
        });
      } catch (playError) {
        if (controller.signal.aborted) return;
        if (htmlAudioStarted || !context) throw playError;

        if (audio && audioUrl) {
          audio.pause();
          releaseAudio(audio, audioUrl);
          audio.removeAttribute('src');
          audio.load();
        }
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

        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            controller.signal.removeEventListener('abort', handleAbort);
            source.onended = null;
            if (currentSource === source) currentSource = null;
            try { source.disconnect(); } catch { /* Already disconnected. */ }
            if (error) reject(error);
            else resolve();
          };
          const handleAbort = () => finish();

          source.onended = () => finish();
          controller.signal.addEventListener('abort', handleAbort, { once: true });
          if (controller.signal.aborted) {
            handleAbort();
            return;
          }
          notifyStart();
          try { source.start(); } catch (error) { finish(error); }
        });
      }
    }

    if (!controller.signal.aborted) onEnd?.();
  } catch (error) {
    if (!isAbortError(error) && !controller.signal.aborted) {
      console.error('[TTS] Edge-TTS playback failed:', error);
      onError?.(error);
    }
  } finally {
    if (currentRequest === controller) currentRequest = null;
  }
}
