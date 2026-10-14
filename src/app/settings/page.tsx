'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AudioLines, Info, Mic, Volume2 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import { disableBackgroundAudio, enableBackgroundAudio, isBackgroundAudioEnabled } from '@/lib/audioSession';
import { LANGUAGES } from '@/lib/languages';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type AppPreferences } from '@/lib/preferences';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadPreferences();
    const backgroundActive = isBackgroundAudioEnabled();
    const next = { ...stored, backgroundMode: stored.backgroundMode && backgroundActive };
    setPreferences(next);
    savePreferences(next);
    setReady(true);
  }, []);

  function updatePreferences(patch: Partial<AppPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    savePreferences(next);
  }

  async function toggleBackgroundMode() {
    if (preferences.backgroundMode) {
      disableBackgroundAudio();
      updatePreferences({ backgroundMode: false });
      toast.success('Background audio keep-alive turned off');
      return;
    }

    const audio = await enableBackgroundAudio();
    if (!audio) {
      toast.error('This browser did not allow background audio. Try again from a direct tap.');
      return;
    }
    updatePreferences({ backgroundMode: true });
    toast.success('Background audio keep-alive enabled');
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 px-4 py-6 text-slate-800 sm:px-6">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/chat" aria-label="Back to voice dashboard" className="rounded-full bg-white/80 p-2.5 shadow-sm hover:bg-white"><ArrowLeft size={20} /></Link>
          <AnimatedLogo size="sm" />
          <span className="w-10" aria-hidden="true" />
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl backdrop-blur sm:p-8">
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Tune how Me AI listens and speaks.</p>

          <div className="mt-7 space-y-1">
            <label htmlFor="language" className="block text-sm font-bold">Language</label>
            <p className="mb-2 text-xs text-slate-500">Used for speech recognition and assistant voice.</p>
            <select
              id="language"
              value={preferences.language}
              disabled={!ready}
              onChange={(event) => updatePreferences({ language: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.flag} {language.english}</option>)}
            </select>
          </div>

          <div className="mt-7 divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-5 py-4">
              <div className="flex gap-3">
                <Volume2 className="mt-0.5 shrink-0 text-emerald-700" size={20} />
                <div><h2 className="text-sm font-bold">Voice replies</h2><p className="mt-0.5 text-xs text-slate-500">Speak assistant replies aloud.</p></div>
              </div>
              <Toggle checked={preferences.voiceEnabled} onChange={() => updatePreferences({ voiceEnabled: !preferences.voiceEnabled })} label="Voice replies" />
            </div>

            <div className="flex items-center justify-between gap-5 py-4">
              <div className="flex gap-3">
                <AudioLines className="mt-0.5 shrink-0 text-amber-600" size={20} />
                <div><h2 className="text-sm font-bold">Background audio mode</h2><p className="mt-0.5 text-xs text-slate-500">Best-effort silent media-session keep-alive.</p></div>
              </div>
              <Toggle checked={preferences.backgroundMode} onChange={() => { void toggleBackgroundMode(); }} label="Background audio mode" />
            </div>

            <div className="flex items-center justify-between gap-5 py-4">
              <div className="flex gap-3">
                <Mic className="mt-0.5 shrink-0 text-rose-600" size={20} />
                <div><h2 className="text-sm font-bold">Auto-listen</h2><p className="mt-0.5 text-xs text-slate-500">Start listening again when a voice reply ends.</p></div>
              </div>
              <Toggle checked={preferences.autoListen} onChange={() => updatePreferences({ autoListen: !preferences.autoListen })} label="Auto-listen after replies" />
            </div>
          </div>

          <aside className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex gap-2 font-bold"><Info size={18} className="shrink-0" />Background behavior depends on your browser and device.</div>
            <p className="mt-2 text-xs leading-5 text-amber-900">This setting keeps a silent media session active where allowed; it cannot guarantee that the browser will keep the microphone, speech recognition, or AI requests running after you switch to Facebook, WhatsApp, or another app. iOS Safari is especially restrictive, and Android browsers may pause background tabs. Keep Me AI open and the screen awake for the most reliable continuous conversation. A home-screen install may make returning easier but does not bypass operating-system microphone limits.</p>
          </aside>
        </section>

        <section className="mt-4 rounded-3xl border border-white/80 bg-white/75 p-5 shadow-sm sm:p-6">
          <h2 className="font-bold">About Me AI</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">A multilingual voice assistant with Urdu, English, and Pashto speech options. Voice input depends on browser speech-recognition support; image questions can be sent from the voice dashboard.</p>
        </section>
      </div>
    </main>
  );
}
