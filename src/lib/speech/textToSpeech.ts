export interface SpeakOptions {
  text: string;
  language?: string;
  voiceTone?: 'deep' | 'natural';
  onStart?: () => void;
  onEnd?: () => void;
  onLevel?: (level: number) => void;
  onError?: (error?: unknown) => void;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const MAX_TTS_CHUNK_LENGTH = 200;

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let currentContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentRequest: AbortController | null = null;
let currentOutputLevelCleanup: (() => void) | null = null;
let currentBrowserSpeechCancel: (() => void) | null = null;

function stopOutputLevelMonitoring() {
  const cleanup = currentOutputLevelCleanup;
  currentOutputLevelCleanup = null;
  cleanup?.();
}

function monitorOutputNode(source: AudioNode, onLevel: (level: number) => void): boolean {
  const context = currentContext;
  if (!context || context.state !== 'running') return false;

  stopOutputLevelMonitoring();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  try {
    source.connect(analyser);
    analyser.connect(context.destination);
  } catch (error) {
    try { source.disconnect(analyser); } catch { /* Source was not connected. */ }
    try { analyser.disconnect(); } catch { /* Analyzer was not connected. */ }
    console.info('[TTS] Could not connect the output level analyzer:', error);
    return false;
  }

  const samples = new Uint8Array(analyser.fftSize);
  let frameId: number | null = null;
  let lastReportedAt = 0;
  const cleanup = () => {
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    frameId = null;
    try { source.disconnect(analyser); } catch { /* Source may already be disconnected. */ }
    try { analyser.disconnect(); } catch { /* Analyzer may already be disconnected. */ }
    onLevel(0);
  };
  currentOutputLevelCleanup = cleanup;

  const sample = () => {
    if (currentOutputLevelCleanup !== cleanup) return;
    analyser.getByteTimeDomainData(samples);
    let sumSquares = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    const now = Date.now();
    if (now - lastReportedAt >= 50) {
      lastReportedAt = now;
      onLevel(Math.round(Math.max(0, Math.min(100, rms * 260))));
    }
    frameId = window.requestAnimationFrame(sample);
  };
  sample();
  return true;
}

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

function speakWithBrowserVoice({
  text,
  language,
  voiceTone,
  signal,
  onStart,
  onLevel,
}: {
  text: string;
  language: string;
  voiceTone: 'deep' | 'natural';
  signal: AbortSignal;
  onStart: () => void;
  onLevel?: (level: number) => void;
}): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return Promise.reject(new Error('Device speech synthesis is unavailable'));
  }

  return new Promise<void>((resolve, reject) => {
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const normalizedLanguage = language.toLowerCase().replace(/_/gu, '-');
    const primaryLanguage = normalizedLanguage.split('-')[0];
    const voices = synthesis.getVoices().filter((voice) => voice.lang.toLowerCase().replace(/_/gu, '-').split('-')[0] === primaryLanguage);
    const maleVoiceHint = /\b(male|david|guy|mark|daniel|james|alex|asad|gulnawaz)\b/iu;
    const selectedVoice = voices.find((voice) => voice.lang.toLowerCase().replace(/_/gu, '-') === normalizedLanguage && maleVoiceHint.test(voice.name))
      ?? voices.find((voice) => voice.lang.toLowerCase().replace(/_/gu, '-') === normalizedLanguage)
      ?? voices.find((voice) => maleVoiceHint.test(voice.name))
      ?? voices[0];

    utterance.lang = language;
    utterance.rate = voiceTone === 'deep' ? 0.94 : 1;
    utterance.pitch = voiceTone === 'deep' ? 0.92 : 1;
    if (selectedVoice) utterance.voice = selectedVoice;

    let settled = false;
    const cleanup = () => {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      signal.removeEventListener('abort', handleAbort);
      if (currentBrowserSpeechCancel === cancel) currentBrowserSpeechCancel = null;
      onLevel?.(0);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      finish();
      try { synthesis.cancel(); } catch { /* The browser speech queue may already be empty. */ }
    };
    const handleAbort = () => cancel();

    utterance.onstart = () => onStart();
    utterance.onend = () => finish();
    utterance.onerror = (event) => {
      if (signal.aborted || event.error === 'canceled' || event.error === 'interrupted') finish();
      else finish(new Error(`Device speech playback failed (${event.error})`));
    };
    currentBrowserSpeechCancel = cancel;
    signal.addEventListener('abort', handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
      return;
    }
    try {
      synthesis.speak(utterance);
    } catch (error) {
      finish(error);
    }
  });
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
  stopOutputLevelMonitoring();
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
  stopOutputLevelMonitoring();
  const cancelBrowserSpeech = currentBrowserSpeechCancel;
  currentBrowserSpeechCancel = null;
  cancelBrowserSpeech?.();

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
  onLevel,
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

      let audioData: ArrayBuffer;
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk, language, voiceTone }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Remote speech synthesis failed (${response.status})`);
        if (!response.headers.get('content-type')?.toLowerCase().startsWith('audio/')) {
          throw new Error('Remote speech response was not audio');
        }
        audioData = await response.arrayBuffer();
        if (!audioData.byteLength) throw new Error('Remote speech response was empty');
      } catch (requestError) {
        if (controller.signal.aborted || isAbortError(requestError)) return;
        console.info('[TTS] Remote speech unavailable; using the device voice fallback.');
        await speakWithBrowserVoice({ text: chunk, language, voiceTone, signal: controller.signal, onStart: notifyStart, onLevel });
        continue;
      }
      if (controller.signal.aborted) return;

      let audioUrl: string | null = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));
      let audio: HTMLAudioElement | null = new Audio(audioUrl);
      let htmlAudioStarted = false;
      audio.preload = 'auto';
      currentAudio = audio;
      currentAudioUrl = audioUrl;

      if (onLevel && context?.state === 'running') {
        let mediaSource: MediaElementAudioSourceNode | null = null;
        try {
          mediaSource = context.createMediaElementSource(audio);
          if (!monitorOutputNode(mediaSource, onLevel)) mediaSource.connect(context.destination);
        } catch (error) {
          if (mediaSource) {
            try { mediaSource.connect(context.destination); } catch { /* Preserve the default audio path when possible. */ }
          }
          onLevel(0);
          console.info('[TTS] Audio level tracking is unavailable for this chunk:', error);
        }
      }

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
        if (!onLevel || !monitorOutputNode(source, onLevel)) source.connect(context.destination);
        currentSource = source;

        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            controller.signal.removeEventListener('abort', handleAbort);
            source.onended = null;
            stopOutputLevelMonitoring();
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
