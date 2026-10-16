'use client';

import { Camera, Download, Maximize2, Minus, Plus, RotateCcw, Square, Video, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type CameraWidgetProps = { onClose: () => void };

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export default function CameraWidget({ onClose }: CameraWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [permissionState, setPermissionState] = useState<'requesting' | 'ready' | 'denied'>('requesting');
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const photoUrlRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const enterFullscreen = useCallback(async () => {
    try {
      if (fullscreenRef.current && document.fullscreenElement !== fullscreenRef.current) {
        await fullscreenRef.current.requestFullscreen();
      }
    } catch (fullscreenError) {
      console.debug('Fullscreen is unavailable:', fullscreenError);
    }
  }, []);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        setPermissionState('ready');
      })
      .catch((cameraError: unknown) => {
        console.error('Camera permission failed:', cameraError);
        if (active) {
          setPermissionState('denied');
          setError('Camera permission was not granted. Please allow camera access and try again.');
        }
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
    if (!capabilities.zoom) return;
    const constraints = { advanced: [{ zoom: Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, zoom)) }] };
    void track.applyConstraints(constraints as unknown as MediaTrackConstraints);
  }, [zoom]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      const nextUrl = URL.createObjectURL(blob);
      photoUrlRef.current = nextUrl;
      setPhotoUrl(nextUrl);
    }, 'image/jpeg', 0.92);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser.');
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' });
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      const nextUrl = URL.createObjectURL(blob);
      videoUrlRef.current = nextUrl;
      setVideoUrl(nextUrl);
    };
    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    void enterFullscreen();
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }

  function closeWidget() {
    if (isRecording) stopRecording();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
  }

  return (
    <div ref={fullscreenRef} className="fixed bottom-5 right-5 z-[80] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/70 bg-slate-950 text-white shadow-2xl shadow-emerald-950/30">
      <div className="flex items-center justify-between bg-slate-900/95 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Camera size={17} className="text-emerald-300" /> Camera window</div>
        <button type="button" onClick={closeWidget} aria-label="Close camera" className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><X size={17} /></button>
      </div>
      <div className="relative aspect-video bg-black">
        {videoUrl ? (
          <video ref={previewVideoRef} src={videoUrl} controls autoPlay className="h-full w-full object-contain" onPlay={() => { void enterFullscreen(); }} />
        ) : permissionState === 'ready' ? (
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">{permissionState === 'requesting' ? 'Requesting camera permission…' : error}</div>
        )}
        {isRecording && <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Recording</div>}
        {photoUrl && !videoUrl && <img src={photoUrl} alt="Captured photo" className="absolute inset-0 h-full w-full object-contain bg-black" />}
      </div>
      {error && permissionState === 'ready' && <p className="px-4 pt-3 text-xs text-amber-200">{error}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2 p-3">
        <button type="button" onClick={capturePhoto} disabled={permissionState !== 'ready' || isRecording} title="Take a picture" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-40"><Camera size={15} /> Photo</button>
        <button type="button" onClick={isRecording ? stopRecording : startRecording} disabled={permissionState !== 'ready'} title={isRecording ? 'Stop video' : 'Start video'} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'} disabled:opacity-40`}>{isRecording ? <Square size={14} /> : <Video size={15} />}{isRecording ? 'Stop' : 'Video'}</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="Zoom out" className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-40"><Minus size={15} /></button>
        <span className="min-w-10 text-center text-xs text-slate-300">{zoom.toFixed(1)}x</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.5))} disabled={zoom >= 4} aria-label="Zoom in" className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-40"><Plus size={15} /></button>
        <button type="button" onClick={() => { setPhotoUrl(null); setVideoUrl(null); setError(''); }} title="Clear capture" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => photoUrl && downloadUrl(photoUrl, 'me-ai-photo.jpg')} disabled={!photoUrl} className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"><Download size={14} /> Photo</button>
        <button type="button" onClick={() => videoUrl && downloadUrl(videoUrl, 'me-ai-video.webm')} disabled={!videoUrl} className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-40"><Download size={14} /> Video</button>
        <button type="button" onClick={() => { void enterFullscreen(); }} aria-label="Fullscreen camera" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><Maximize2 size={15} /></button>
      </div>
    </div>
  );
}
