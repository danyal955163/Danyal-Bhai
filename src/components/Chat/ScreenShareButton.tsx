'use client';

import { useEffect, useRef } from 'react';
import { Monitor, MonitorX } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ScreenShareButtonProps {
  onFrame: (base64: string) => void;
  active: boolean;
  language: string;
  onStart: () => void;
  onStop: () => void;
}

const MAX_FRAME_DIMENSION = 1_280;
const FRAME_INTERVAL_MS = 2_000;

function localizedMessage(language: string, key: 'unsupported' | 'cancelled' | 'started' | 'stopped' | 'failed') {
  const messages: Record<string, Record<typeof key, string>> = {
    'ur-PK': {
      unsupported: 'آپ کے براؤزر میں اسکرین شیئر سپورٹ نہیں۔ اسکرین شاٹ لیں اور یہاں منسلک کریں۔',
      cancelled: 'اسکرین شیئر منسوخ ہوا۔ آپ اسکرین شاٹ منسلک کر سکتے ہیں۔',
      started: 'اسکرین شیئر فعال ہے۔ پہلی تصویر AI کو بھیجی جائے گی؛ بعد کی تصاویر صرف آپ کے پیغامات کے ساتھ جائیں گی۔',
      stopped: 'اسکرین شیئر بند کر دیا گیا۔',
      failed: 'اسکرین شیئر شروع نہیں ہو سکا۔ اسکرین شاٹ منسلک کر کے کوشش کریں۔',
    },
    'ps-AF': {
      unsupported: 'ستاسو براوزر د سکرین شریکولو ملاتړ نه کوي. سکرین‌شاټ واخلئ او دلته یې ونښلوئ.',
      cancelled: 'د سکرین شریکول لغوه شول. تاسو کولی شئ سکرین‌شاټ ونښلوئ.',
      started: 'د سکرین شریکول فعال دي. لومړی انځور AI ته لېږل کېږي؛ وروسته انځورونه یوازې ستاسو د پیغامونو سره ځي.',
      stopped: 'د سکرین شریکول بند شول.',
      failed: 'د سکرین شریکول پیل نه شول. د سکرین‌شاټ په نښلولو سره بیا هڅه وکړئ.',
    },
    'en-US': {
      unsupported: 'Screen sharing is not supported in this browser. Take a screenshot and attach it here.',
      cancelled: 'Screen sharing was cancelled. You can attach a screenshot instead.',
      started: 'Screen sharing is on. One initial snapshot is analyzed; later snapshots are sent only with your messages.',
      stopped: 'Screen sharing stopped.',
      failed: 'Could not start screen sharing. Try taking and attaching a screenshot instead.',
    },
  };
  return messages[language]?.[key] ?? messages['en-US'][key];
}

export default function ScreenShareButton({ onFrame, active, language, onStart, onStop }: ScreenShareButtonProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const onFrameRef = useRef(onFrame);
  const onStartRef = useRef(onStart);
  const onStopRef = useRef(onStop);
  const stopShareRef = useRef<() => void>(() => undefined);

  onFrameRef.current = onFrame;
  onStartRef.current = onStart;
  onStopRef.current = onStop;

  function clearShareResources(notifyParent: boolean, showToast: boolean) {
    const hadResources = streamRef.current !== null || intervalRef.current !== null;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const video = videoRef.current;
    videoRef.current = null;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
    }

    if (notifyParent && hadResources) onStopRef.current();
    if (showToast && hadResources) toast.success(localizedMessage(language, 'stopped'));
  }

  stopShareRef.current = () => clearShareResources(true, true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearShareResources(false, false);
    };
  }, []);

  function captureFrame(video: HTMLVideoElement): boolean {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return false;
    const scale = Math.min(1, MAX_FRAME_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return false;

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onFrameRef.current(canvas.toDataURL('image/jpeg', 0.55));
      return true;
    } catch (error) {
      console.error('Could not capture a screen frame:', error);
      return false;
    }
  }

  async function startShare() {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error(localizedMessage(language, 'unsupported'));
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 1, max: 1 },
          width: { max: MAX_FRAME_DIMENSION },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      streamRef.current = stream;
      videoRef.current = video;

      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('The selected screen source has no video track.');
      track.onended = () => stopShareRef.current();

      await video.play();
      if (!mountedRef.current || streamRef.current !== stream) return;

      let firstFrameCaptured = false;
      for (let attempt = 0; attempt < 20 && !firstFrameCaptured; attempt += 1) {
        if (!mountedRef.current || streamRef.current !== stream) return;
        firstFrameCaptured = captureFrame(video);
        if (!firstFrameCaptured) await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
      }
      if (!firstFrameCaptured) throw new Error('The first screen frame could not be captured.');

      onStartRef.current();
      toast.success(localizedMessage(language, 'started'));
      intervalRef.current = window.setInterval(() => {
        if (streamRef.current === stream && videoRef.current === video) captureFrame(video);
      }, FRAME_INTERVAL_MS);
    } catch (error) {
      if (stream && streamRef.current === stream) {
        clearShareResources(true, false);
      } else if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const name = typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name: unknown }).name)
        : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        toast.error(localizedMessage(language, 'cancelled'));
      } else {
        console.error('Could not start screen sharing:', error);
        toast.error(localizedMessage(language, 'failed'));
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => active ? stopShareRef.current() : void startShare()}
      aria-label={active ? 'Stop screen sharing' : 'Share your screen'}
      aria-pressed={active}
      title={active ? 'Stop screen sharing' : 'Share your screen. One initial snapshot is analyzed; later snapshots are sent with your messages.'}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95 ${active ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-white/70 bg-white/85 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
    >
      {active ? <MonitorX size={18} /> : <Monitor size={18} />}
      <span>{active ? 'Stop sharing' : 'Share screen'}</span>
    </button>
  );
}
