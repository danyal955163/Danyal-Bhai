let backgroundAudio: HTMLAudioElement | null = null;

function updateMediaSession(state: 'playing' | 'none') {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
    if (state === 'playing' && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Me AI',
        artist: 'Voice Assistant',
        album: 'Me AI',
      });
    }
  } catch (error) {
    console.info('[Background audio] Media Session metadata is unavailable:', error);
  }
}

export async function enableBackgroundAudio(): Promise<HTMLAudioElement | null> {
  if (typeof window === 'undefined') return null;
  if (backgroundAudio && !backgroundAudio.paused) return backgroundAudio;

  const audio = new Audio('/silent.mp3');
  audio.loop = true;
  audio.volume = 0.01;
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');

  try {
    await audio.play();
    backgroundAudio = audio;
    updateMediaSession('playing');
    return audio;
  } catch (error) {
    console.warn('[Background audio] Browser did not allow background playback:', error);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    return null;
  }
}

export function disableBackgroundAudio(): void {
  if (backgroundAudio) {
    backgroundAudio.pause();
    backgroundAudio.removeAttribute('src');
    backgroundAudio.load();
    backgroundAudio = null;
  }
  updateMediaSession('none');
}

export function isBackgroundAudioEnabled(): boolean {
  return Boolean(backgroundAudio && !backgroundAudio.paused);
}
