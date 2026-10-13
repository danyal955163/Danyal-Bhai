export type SpeakOptions = {
  text: string;
  language: string;
  pitch?: number;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export function speak({
  text,
  language,
  pitch = 0.85,
  rate = 0.95,
  onStart,
  onEnd,
  onError,
}: SpeakOptions) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const languagePrefix = language.slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const preferredNames = languagePrefix === 'ur'
    ? ['Microsoft Asad', 'Google اردو']
    : languagePrefix === 'ar'
      ? ['Microsoft Hamed', 'Maged']
      : ['Microsoft David', 'Google UK English Male'];
  const maleVoice = voices.find((voice) => preferredNames.some((name) => voice.name.includes(name)))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix) && /male|david|asad|hamed/i.test(voice.name));
  const languageVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));

  utterance.lang = language;
  utterance.rate = rate;
  utterance.pitch = maleVoice ? pitch : 0.7;
  if (maleVoice ?? languageVoice) utterance.voice = maleVoice ?? languageVoice ?? null;
  utterance.onstart = onStart ?? null;
  utterance.onend = onEnd ?? null;
  utterance.onerror = onError ?? null;
  window.speechSynthesis.speak(utterance);
}
