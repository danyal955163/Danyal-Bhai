export type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

export type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

export type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

export type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export function createSpeechRecognition(language = 'ur-PK'): SpeechRecognitionInstance | null {
  if (typeof window === 'undefined') return null;

  const speechWindow = window as SpeechWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = language;
  recognition.maxAlternatives = 1;
  return recognition;
}
