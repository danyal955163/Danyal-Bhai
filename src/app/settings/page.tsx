'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, AudioLines, Camera, Info, Mic, Monitor, Volume2, VolumeX } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import { disableBackgroundAudio, enableBackgroundAudio, isBackgroundAudioEnabled } from '@/lib/audioSession';
import { LANGUAGES } from '@/lib/languages';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type AppPreferences, type VoiceTone } from '@/lib/preferences';
import { speak, stopSpeaking } from '@/lib/speech/textToSpeech';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';
type DevicePermission = 'microphone' | 'camera';

const COPY = {
  'ur-PK': {
    title: 'سیٹنگز', description: 'آواز، زبان اور ڈیوائس اجازتیں اپنے مطابق رکھیں۔', language: 'گفتگو اور آواز کی زبان', voice: 'آواز کے جواب', voiceHint: 'جواب پاکستانی مردانہ آواز میں سنیں۔', tone: 'آواز کا انداز', deep: 'گہری، پُر اعتماد مردانہ آواز', natural: 'قدرتی مردانہ آواز', test: 'آواز سنیں', mic: 'مائیکروفون', camera: 'کیمرہ', permission: 'اجازت دیں', granted: 'اجازت فعال ہے', denied: 'اجازت بند ہے — browser settings دیکھیں', prompt: 'ابھی اجازت نہیں دی گئی', unknown: 'اجازت کی حالت معلوم نہیں', screen: 'اسکرین شیئرنگ', screenHint: 'اسکرین شیئر صرف آپ کے منتخب کرنے پر شروع ہوگا۔ ہر بار browser کا انتخابی ڈائیلاگ کھلے گا؛ Settings سے اسے پہلے سے اجازت نہیں دی جا سکتی۔', screenButton: 'چیٹ پر جائیں', speaker: 'اسپیکر کی آواز', speakerHint: 'ویب سائٹ اسپیکر کی permission نہیں مانگتی؛ فون کا media volume بڑھائیں۔', auto: 'خودکار طور پر دوبارہ سننا', noise: 'پس منظر کے شور کو کم کرنا', background: 'پس منظر کی audio session', about: 'کیمرہ اور رازداری', privacy: 'کیمرہ صرف آپ کے بٹن یا voice command کے بعد تصویر/ویڈیو بناتا ہے۔ فائل پہلے اس ڈیوائس پر رہتی ہے؛ محفوظ کرنے کے لیے Download دبائیں۔', back: 'واپس', saved: 'ترتیب محفوظ ہو گئی', error: 'اجازت حاصل نہیں ہو سکی۔ browser میں Camera/Microphone اجازت دیں۔', info: 'Browser کی اجازت الگ سے ضروری ہے؛ ویب سائٹ اسے خاموشی سے فعال نہیں کر سکتی۔',
  },
  'en-US': {
    title: 'Settings', description: 'Choose how Me AI speaks, listens, and uses device permissions.', language: 'Conversation and voice language', voice: 'Voice replies', voiceHint: 'Replies use a masculine neural voice.', tone: 'Voice tone', deep: 'Warm, deeper male voice', natural: 'Natural male voice', test: 'Test voice', mic: 'Microphone', camera: 'Camera', permission: 'Allow access', granted: 'Permission granted', denied: 'Blocked — check browser settings', prompt: 'Not granted yet', unknown: 'Permission status unavailable', screen: 'Screen sharing', screenHint: 'Screen sharing starts only when you choose it. Your browser asks you to select a screen/window each time; websites cannot pre-authorize it in Settings.', screenButton: 'Open chat', speaker: 'Speaker output', speakerHint: 'Browsers do not expose a speaker permission. Turn up your device media volume.', auto: 'Auto-listen after replies', noise: 'Background noise filter', background: 'Background audio mode', about: 'Camera and privacy', privacy: 'The camera captures only after your tap or voice command. Captures stay on this device until you tap Download.', back: 'Back', saved: 'Settings saved', error: 'Access was not granted. Allow Camera/Microphone in your browser.', info: 'Browser permission is separate; the website cannot enable it silently.',
  },
  'ps-AF': {
    title: 'امستنې', description: 'د Me AI غږ، اورېدنه او د وسیلې اجازې وټاکئ.', language: 'د خبرو او غږ ژبه', voice: 'غږیز ځوابونه', voiceHint: 'ځوابونه په نارینه غږ اورئ.', tone: 'د غږ ډول', deep: 'تود او ژور نارینه غږ', natural: 'طبیعي نارینه غږ', test: 'غږ واورئ', mic: 'مایکروفون', camera: 'کامره', permission: 'اجازه ورکړئ', granted: 'اجازه فعاله ده', denied: 'بنده ده — د براوزر امستنې وګورئ', prompt: 'تر اوسه اجازه نه ده ورکړل شوې', unknown: 'د اجازې حالت نه دی معلوم', screen: 'سکرین شریکول', screenHint: 'سکرین شریکول یوازې ستاسو په انتخاب پیلېږي. براوزر به هر ځل د سکرین/کړکۍ د ټاکلو کړکۍ وښيي؛ په امستنو کې یې مخکې اجازه نه شي ورکول کېدای.', screenButton: 'چیټ پرانیزئ', speaker: 'د سپیکر غږ', speakerHint: 'براوزر د سپیکر اجازه نه غواړي؛ د وسیلې غږ لوړ کړئ.', auto: 'له ځواب وروسته بیا اورېدل', noise: 'د شالید شور کمول', background: 'د شالید غږ حالت', about: 'کامره او محرمیت', privacy: 'کامره یوازې ستاسو له تڼۍ یا غږیز امر وروسته عکس/ویډیو اخلي. فایل په همدې وسیله کې پاتې کېږي؛ د خوندي کولو لپاره Download کېکاږئ.', back: 'شاته', saved: 'امستنې خوندي شوې', error: 'اجازه ترلاسه نه شوه. په براوزر کې د کامرې/مایکروفون اجازه ورکړئ.', info: 'د براوزر اجازه جلا ده؛ وېبپاڼه یې په پټه نه شي فعالولای.',
  },
} as const;

function permissionLabel(state: PermissionState, copy: { granted: string; denied: string; prompt: string; unknown: string }) {
  if (state === 'granted') return copy.granted;
  if (state === 'denied') return copy.denied;
  if (state === 'prompt') return copy.prompt;
  return copy.unknown;
}

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [permissions, setPermissions] = useState<Record<DevicePermission, PermissionState>>({ microphone: 'unknown', camera: 'unknown' });
  const copy = COPY[preferences.language as keyof typeof COPY] ?? COPY['ur-PK'];
  const isRtl = preferences.language === 'ur-PK' || preferences.language === 'ps-AF';

  async function refreshPermissions() {
    const queryPermission = async (name: DevicePermission): Promise<PermissionState> => {
      try {
        const result = await navigator.permissions.query({ name: name as PermissionName });
        return result.state;
      } catch {
        return 'unknown';
      }
    };
    const [microphone, camera] = await Promise.all([queryPermission('microphone'), queryPermission('camera')]);
    setPermissions({ microphone, camera });
  }

  useEffect(() => {
    const stored = loadPreferences();
    const backgroundActive = isBackgroundAudioEnabled();
    const next = { ...stored, backgroundMode: stored.backgroundMode && backgroundActive };
    setPreferences(next);
    savePreferences(next);
    setReady(true);
    void refreshPermissions();
    return () => stopSpeaking();
  }, []);

  function updatePreferences(patch: Partial<AppPreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    savePreferences(next);
    toast.success(copy.saved);
  }

  async function requestDevicePermission(kind: DevicePermission) {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(copy.error);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: { facingMode: 'user' }, audio: false } : { audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await refreshPermissions();
      toast.success(copy.granted);
    } catch (error) {
      console.warn(`Could not request ${kind} permission:`, error);
      await refreshPermissions();
      toast.error(copy.error);
    }
  }

  async function toggleBackgroundMode() {
    if (preferences.backgroundMode) {
      disableBackgroundAudio();
      updatePreferences({ backgroundMode: false });
      return;
    }
    const audio = await enableBackgroundAudio();
    if (!audio) {
      toast.error('Background audio was blocked. Try again after a direct tap.');
      return;
    }
    updatePreferences({ backgroundMode: true });
  }

  function testVoice() {
    stopSpeaking();
    setTestingVoice(true);
    const text = preferences.language === 'ur-PK'
      ? 'السلام علیکم، میں می اے آئی ہوں۔ میں آپ کی مدد کے لیے حاضر ہوں۔'
      : preferences.language === 'ps-AF'
        ? 'سلامونه، زه مې اې آی یم. ستاسو د مرستې لپاره چمتو یم.'
        : 'Hello, I am Me AI. I am here to help you.';
    void speak({
      text,
      language: preferences.language,
      voiceTone: preferences.voiceTone,
      onEnd: () => setTestingVoice(false),
      onError: () => { setTestingVoice(false); toast.error('Voice preview could not play. Tap to try again.'); },
    });
  }

  return (
    <main dir={isRtl ? 'rtl' : 'ltr'} lang={preferences.language} className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,rgba(255,224,130,.34),transparent_38%),linear-gradient(145deg,#f4fbff,#fffdf7_48%,#eaf9f2)] px-4 py-5 text-slate-800 sm:px-6">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-2xl">
        <header className="mb-5 flex items-center justify-between">
          <Link href="/chat" aria-label={copy.back} className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm hover:bg-white"><ArrowLeft size={19} /></Link>
          <AnimatedLogo size="sm" />
          <span className="w-10" aria-hidden="true" />
        </header>

        <section className="rounded-[1.75rem] border border-white/85 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <h1 className="text-2xl font-black tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{copy.description}</p>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <label htmlFor="language" className="block text-sm font-bold">{copy.language}</label>
            <select id="language" value={preferences.language} disabled={!ready} onChange={(event) => updatePreferences({ language: event.target.value })} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.flag} {language.name} · {language.english}</option>)}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-600">{copy.info}</p>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex gap-3"><Volume2 className="mt-0.5 shrink-0 text-emerald-700" size={20} /><div><h2 className="text-sm font-bold">{copy.voice}</h2><p className="mt-0.5 text-xs text-slate-500">{copy.voiceHint}</p></div></div>
              <Toggle checked={preferences.voiceEnabled} onChange={() => updatePreferences({ voiceEnabled: !preferences.voiceEnabled })} label={copy.voice} />
            </div>

            <div className="py-4">
              <label htmlFor="voice-tone" className="block text-sm font-bold">{copy.tone}</label>
              <div className="mt-2 flex gap-2">
                <select id="voice-tone" value={preferences.voiceTone} onChange={(event) => updatePreferences({ voiceTone: event.target.value as VoiceTone })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                  <option value="deep">{copy.deep}</option>
                  <option value="natural">{copy.natural}</option>
                </select>
                <button type="button" onClick={testVoice} disabled={testingVoice} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{testingVoice ? '…' : copy.test}</button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex gap-3"><Mic className="mt-0.5 shrink-0 text-rose-600" size={20} /><div><h2 className="text-sm font-bold">{copy.mic}</h2><p className="mt-0.5 text-xs text-slate-500">{permissionLabel(permissions.microphone, copy)}</p></div></div>
              <button type="button" onClick={() => void requestDevicePermission('microphone')} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-800 hover:bg-rose-100"><Mic size={15} />{copy.permission}</button>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex gap-3"><Camera className="mt-0.5 shrink-0 text-amber-700" size={20} /><div><h2 className="text-sm font-bold">{copy.camera}</h2><p className="mt-0.5 text-xs text-slate-500">{permissionLabel(permissions.camera, copy)}</p></div></div>
              <button type="button" onClick={() => void requestDevicePermission('camera')} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100"><Camera size={15} />{copy.permission}</button>
            </div>

            <div className="py-4">
              <div className="flex gap-3"><Monitor className="mt-0.5 shrink-0 text-sky-700" size={20} /><div><h2 className="text-sm font-bold">{copy.screen}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{copy.screenHint}</p><Link href="/chat" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800">{copy.screenButton}<Monitor size={14} /></Link></div></div>
            </div>

            <div className="flex items-center justify-between gap-4 py-4">
              <div className="flex gap-3"><AudioLines className="mt-0.5 shrink-0 text-amber-600" size={20} /><div><h2 className="text-sm font-bold">{copy.speaker}</h2><p className="mt-0.5 text-xs text-slate-500">{copy.speakerHint}</p></div></div>
              {preferences.voiceEnabled ? <Volume2 className="shrink-0 text-emerald-700" size={20} /> : <VolumeX className="shrink-0 text-slate-400" size={20} />}
            </div>

            <div className="flex items-center justify-between gap-5 py-4">
              <div className="flex gap-3"><Mic className="mt-0.5 shrink-0 text-rose-600" size={20} /><div><h2 className="text-sm font-bold">{copy.auto}</h2><p className="mt-0.5 text-xs text-slate-500">{preferences.autoListen ? 'On' : 'Off'}</p></div></div>
              <Toggle checked={preferences.autoListen} onChange={() => updatePreferences({ autoListen: !preferences.autoListen })} label={copy.auto} />
            </div>

            <div className="py-4">
              <label htmlFor="noise-filter" className="block text-sm font-bold">{copy.noise}</label>
              <select id="noise-filter" value={preferences.noiseFilterLevel} disabled={!ready} onChange={(event) => updatePreferences({ noiseFilterLevel: event.target.value as AppPreferences['noiseFilterLevel'] })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                <option value="low">Low</option><option value="medium">Medium — recommended</option><option value="high">High</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-5 py-4">
              <div className="flex gap-3"><AudioLines className="mt-0.5 shrink-0 text-amber-600" size={20} /><div><h2 className="text-sm font-bold">{copy.background}</h2><p className="mt-0.5 text-xs text-slate-500">Best effort; browser-dependent.</p></div></div>
              <Toggle checked={preferences.backgroundMode} onChange={() => { void toggleBackgroundMode(); }} label={copy.background} />
            </div>
          </div>

          <aside className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-950"><Info size={18} />{copy.about}</div>
            <p className="mt-2 text-xs leading-5 text-amber-900">{copy.privacy}</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
