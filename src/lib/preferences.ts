export type AppPreferences = {
  language: string;
  voiceEnabled: boolean;
  voiceTone: VoiceTone;
  backgroundMode: boolean;
  autoListen: boolean;
  noiseFilterLevel: NoiseFilterLevel;
};

export type NoiseFilterLevel = 'low' | 'medium' | 'high';
export type VoiceTone = 'deep' | 'natural';

export const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'ur-PK',
  voiceEnabled: true,
  voiceTone: 'deep',
  backgroundMode: false,
  autoListen: true,
  noiseFilterLevel: 'medium',
};

const STORAGE_KEY = 'me-ai.preferences.v1';
const SUPPORTED_LANGUAGES = new Set(['ur-PK', 'en-US', 'ps-AF']);

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES;
    const stored = value as Partial<AppPreferences>;
    return {
      language: typeof stored.language === 'string' && SUPPORTED_LANGUAGES.has(stored.language)
        ? stored.language
        : DEFAULT_PREFERENCES.language,
      voiceEnabled: typeof stored.voiceEnabled === 'boolean' ? stored.voiceEnabled : DEFAULT_PREFERENCES.voiceEnabled,
      voiceTone: stored.voiceTone === 'natural' || stored.voiceTone === 'deep' ? stored.voiceTone : DEFAULT_PREFERENCES.voiceTone,
      backgroundMode: typeof stored.backgroundMode === 'boolean' ? stored.backgroundMode : DEFAULT_PREFERENCES.backgroundMode,
      autoListen: typeof stored.autoListen === 'boolean' ? stored.autoListen : DEFAULT_PREFERENCES.autoListen,
      noiseFilterLevel: stored.noiseFilterLevel === 'low' || stored.noiseFilterLevel === 'high' || stored.noiseFilterLevel === 'medium'
        ? stored.noiseFilterLevel
        : DEFAULT_PREFERENCES.noiseFilterLevel,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AppPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent<AppPreferences>('me-ai:preferences', { detail: preferences }));
  } catch (error) {
    console.warn('[Preferences] Could not save local settings:', error);
  }
}
