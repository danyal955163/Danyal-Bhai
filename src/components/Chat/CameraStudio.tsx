'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Circle, Download, LoaderCircle, Square, Video, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

export type CameraCommand = { id: number; action: 'photo' | 'record' | 'stop' };

type CameraStudioProps = {
  open: boolean;
  onClose: () => void;
  language: string;
  command: CameraCommand | null;
};

function message(language: string, key: 'permission' | 'unsupported' | 'photoReady' | 'recordStarted' | 'videoReady' | 'recordUnsupported') {
  const copy: Record<string, Record<typeof key, string>> = {
    'ur-PK': {
      permission: 'تصویر یا ویڈیو بنانے کے لیے کیمرے کی اجازت دیں۔',
      unsupported: 'اس براؤزر میں کیمرہ دستیاب نہیں۔',
      photoReady: 'تصویر تیار ہے۔ محفوظ کرنے کے لیے Download دبائیں۔',
      recordStarted: 'ویڈیو ریکارڈنگ شروع ہو گئی۔ روکنے کے لیے Stop دبائیں یا کہیں “ریکارڈنگ بند کرو”۔',
      videoReady: 'ویڈیو تیار ہے۔ محفوظ کرنے کے لیے Download دبائیں۔',
      recordUnsupported: 'اس براؤزر میں ویڈیو ریکارڈنگ دستیاب نہیں۔',
    },
    'ps-AF': {
      permission: 'د انځور یا ویډیو لپاره د کامرې اجازه ورکړئ.',
      unsupported: 'په دې براوزر کې کامره نشته.',
      photoReady: 'انځور چمتو دی. د خوندي کولو لپاره Download کېکاږئ.',
      recordStarted: 'د ویډیو ثبت پیل شو. د بندولو لپاره Stop کېکاږئ یا ووایئ “ثبت بند کړه”.',
      videoReady: 'ویډیو چمتو ده. د خوندي کولو لپاره Download کېکاږئ.',
      recordUnsupported: 'په دې براوزر کې د ویډیو ثبت نشته.',
    },
    'en-US': {
      permission: 'Allow camera access to take a photo or record a video.',
      unsupported: 'Camera access is not available in this browser.',
      photoReady: 'Photo ready. Tap Download to save it.',
      recordStarted: 'Recording started. Tap Stop or say “stop recording”.',
      videoReady: 'Video ready. Tap Download to save it.',
      recordUnsupported: 'Video recording is not available in this browser.',
    },
  };
  return (copy[language] ?? copy['en-US'])[key];
}

export default function CameraStudio({ open, onClose, language, command }: CameraStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const photoUrlRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  const captureGenerationRef = useRef(0);
  const lastCommandIdRef = useRef(0);
  const pendingCommandRef = useRef<CameraCommand | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExtension, setVideoExtension] = useState<'mp4' | 'webm'>('webm');
  const isRtl = language === 'ur-PK' || language === 'ps-AF';

  const revokeCaptureUrls = useCallback(() => {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    photoUrlRef.current = null;
    videoUrlRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const takePhoto = useCallback(async () => {
    const generation = captureGenerationRef.current;
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
      toast.error(message(language, 'permission'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    if (generation !== captureGenerationRef.current || !streamRef.current) return;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    photoUrlRef.current = nextUrl;
    setPhotoUrl(nextUrl);
    toast.success(message(language, 'photoReady'));
  }, [language]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      toast.error(message(language, 'recordUnsupported'));
      return;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return;
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      .find((type) => MediaRecorder.isTypeSupported?.(type));
    try {
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      let finalized = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (!finalized && event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (finalized || recorderRef.current !== recorder) return;
        finalized = true;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        if (!blob.size) return;
        if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
        const nextUrl = URL.createObjectURL(blob);
        videoUrlRef.current = nextUrl;
        setVideoUrl(nextUrl);
        setVideoExtension(blob.type.includes('mp4') ? 'mp4' : 'webm');
        toast.success(message(language, 'videoReady'));
      };
      recorder.onerror = () => {
        if (finalized) return;
        finalized = true;
        if (recorderRef.current === recorder) recorderRef.current = null;
        chunksRef.current = [];
        recorder.ondataavailable = null;
        recorder.onstop = null;
        setRecording(false);
        toast.error(message(language, 'recordUnsupported'));
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* Recorder has already stopped. */ }
      };
      recorderRef.current = recorder;
      recorder.start(300);
      setRecording(true);
      toast.success(message(language, 'recordStarted'));
    } catch (captureError) {
      console.error('Could not start camera recording:', captureError);
      toast.error(message(language, 'recordUnsupported'));
    }
  }, [language]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const runCommand = useCallback((action: CameraCommand['action']) => {
    if (action === 'photo') void takePhoto();
    else if (action === 'record') startRecording();
    else stopRecording();
  }, [startRecording, stopRecording, takePhoto]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    captureGenerationRef.current += 1;
    setError('');
    setCameraReady(false);
    setRecording(false);
    setPhotoUrl(null);
    setVideoUrl(null);
    pendingCommandRef.current = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(message(language, 'unsupported'));
      return;
    }
    void navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
    }).catch((cameraError: unknown) => {
      if (cancelled) return;
      const name = typeof cameraError === 'object' && cameraError !== null && 'name' in cameraError
        ? String((cameraError as { name: unknown }).name)
        : '';
      setError(name === 'NotAllowedError' ? message(language, 'permission') : message(language, 'unsupported'));
    });
    return () => {
      cancelled = true;
      captureGenerationRef.current += 1;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* Recorder may already have stopped. */ }
      }
      recorderRef.current = null;
      stopStream();
      revokeCaptureUrls();
      pendingCommandRef.current = null;
    };
  }, [language, open, revokeCaptureUrls, stopStream]);

  useEffect(() => {
    if (!open || !command || command.id <= lastCommandIdRef.current) return;
    lastCommandIdRef.current = command.id;
    if (!cameraReady) {
      pendingCommandRef.current = command;
      return;
    }
    runCommand(command.action);
  }, [cameraReady, command, open, runCommand]);

  useEffect(() => {
    if (!open || !cameraReady || !pendingCommandRef.current) return;
    const pending = pendingCommandRef.current;
    pendingCommandRef.current = null;
    runCommand(pending.action);
  }, [cameraReady, open, runCommand]);

  function closeStudio() {
    if (recording) {
      stopRecording();
      toast(language === 'ur-PK'
        ? 'ریکارڈنگ روک دی ہے؛ ویڈیو تیار ہونے پر پہلے Download کریں۔'
        : language === 'ps-AF'
          ? 'ثبت ودرول شو؛ ویډیو چې چمتو شي، لومړی یې Download کړئ.'
          : 'Recording stopped; download the video when it is ready.');
      return;
    }
    setCameraReady(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={language === 'ur-PK' ? 'کیمرہ اسٹوڈیو' : language === 'ps-AF' ? 'د کامرې سټوډیو' : 'Camera studio'}>
      <section dir={isRtl ? 'rtl' : 'ltr'} className="w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#fffdf7] shadow-2xl">
        <header className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-800"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Camera size={19} /></span><div><h2 className="font-extrabold">{language === 'ur-PK' ? 'کیمرہ اسٹوڈیو' : language === 'ps-AF' ? 'د کامرې سټوډیو' : 'Camera studio'}</h2><p className="text-[11px] text-slate-500">{language === 'ur-PK' ? 'تصویر اور ویڈیو صرف اس ڈیوائس پر رہتی ہے۔' : language === 'ps-AF' ? 'انځور او ویډیو یوازې په همدې وسیله کې پاتې کېږي.' : 'Photos and videos stay on this device.'}</p></div></div>
          <button type="button" onClick={closeStudio} aria-label="Close camera" className="rounded-full p-2 text-slate-600 hover:bg-amber-50"><X size={20} /></button>
        </header>

        <div className="relative aspect-video bg-slate-950">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {!cameraReady && !error && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80"><LoaderCircle size={18} className="animate-spin" />{language === 'ur-PK' ? 'کیمرہ کھل رہا ہے…' : language === 'ps-AF' ? 'کامره پرانیستل کېږي…' : 'Opening camera…'}</div>}
          {error && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white">{error}</div>}
          {recording && <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />REC</div>}
        </div>

        <div className="grid grid-cols-3 gap-2 p-3 sm:p-4">
          <button type="button" onClick={() => void takePhoto()} disabled={!cameraReady || recording} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-200 disabled:opacity-45"><Camera size={18} />{language === 'ur-PK' ? 'تصویر' : language === 'ps-AF' ? 'انځور' : 'Photo'}</button>
          {!recording ? (
            <button type="button" onClick={startRecording} disabled={!cameraReady} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-45"><Circle size={16} fill="currentColor" />{language === 'ur-PK' ? 'ریکارڈ' : language === 'ps-AF' ? 'ثبت' : 'Record'}</button>
          ) : (
            <button type="button" onClick={stopRecording} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-bold text-white hover:bg-slate-900"><Square size={15} fill="currentColor" />Stop</button>
          )}
          <button type="button" onClick={closeStudio} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">{language === 'ur-PK' ? 'بند کریں' : language === 'ps-AF' ? 'وتړئ' : 'Close'}</button>
        </div>

        <div className="space-y-2 px-4 pb-4">
          {photoUrl && <a href={photoUrl} download={`me-ai-photo-${Date.now()}.jpg`} className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-950"><Download size={16} />{language === 'ur-PK' ? 'تصویر محفوظ کریں' : language === 'ps-AF' ? 'انځور خوندي کړئ' : 'Download photo'}</a>}
          {videoUrl && <a href={videoUrl} download={`me-ai-video-${Date.now()}.${videoExtension}`} className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-950"><Video size={16} />{language === 'ur-PK' ? 'ویڈیو محفوظ کریں' : language === 'ps-AF' ? 'ویډیو خوندي کړئ' : 'Download video'}</a>}
          <p className="text-center text-[11px] leading-5 text-slate-500">{language === 'ur-PK' ? 'آواز سے کہیں: “تصویر کھینچو”، “ویڈیو شروع کرو”، یا “ریکارڈنگ بند کرو”۔ محفوظ کرنے کے لیے اوپر Download دبائیں۔' : language === 'ps-AF' ? 'ووایئ: “انځور واخله”، “ویډیو پیل کړه”، یا “ثبت بند کړه”. د خوندي کولو لپاره Download کېکاږئ.' : 'Say “take a picture”, “start recording”, or “stop recording”. Tap Download to save captured media.'}</p>
        </div>
      </section>
    </div>
  );
}
