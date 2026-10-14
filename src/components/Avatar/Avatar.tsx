'use client';

import { useEffect, useState } from 'react';

interface AvatarProps {
  photoUrl: string;
  isSpeaking: boolean;
  isListening: boolean;
}

export default function Avatar({
  photoUrl,
  isSpeaking,
  isListening,
}: AvatarProps) {
  const [blink, setBlink] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let closeBlinkTimer: ReturnType<typeof setTimeout> | undefined;
    const blinkInterval = setInterval(() => {
      setBlink(true);
      closeBlinkTimer = setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 2000);

    return () => {
      clearInterval(blinkInterval);
      if (closeBlinkTimer) clearTimeout(closeBlinkTimer);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {isSpeaking && (
        <div className="pointer-events-none absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-[min(88vw,24rem)] w-[min(88vw,24rem)]">
            <span className="absolute inset-0 animate-ping-slow rounded-full border-2 border-emerald-400/40" />
            <span className="absolute inset-4 animate-ping-slow rounded-full border-2 border-emerald-400/30 [animation-delay:300ms]" />
            <span className="absolute inset-8 animate-ping-slow rounded-full border-2 border-emerald-400/20 [animation-delay:600ms]" />
          </div>
        </div>
      )}

      {isListening && (
        <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 animate-pulse whitespace-nowrap rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          Listening...
        </div>
      )}

      <div className="relative flex max-h-full flex-col items-center justify-center">
        <div className={isSpeaking ? 'animate-sway-speaking' : 'animate-sway'}>
          <div className="relative">
            <div
              className={`absolute inset-0 rounded-full transition-all duration-500 ${
                isSpeaking
                  ? 'shadow-2xl shadow-emerald-400/50 ring-8 ring-emerald-400/30'
                  : 'shadow-xl ring-4 ring-white'
              }`}
            />
            <div
              className={`relative h-72 w-72 max-h-[calc(50vh-5rem)] max-w-[88vw] overflow-hidden rounded-full border-4 border-white bg-white shadow-2xl sm:h-80 sm:w-80 ${
                isSpeaking ? 'scale-105' : 'scale-100'
              } transition-transform duration-300`}
            >
              {imageFailed ? (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-300 to-yellow-600 text-8xl font-black text-white">
                  D
                </div>
              ) : (
                <img
                  src={photoUrl}
                  alt="Danyal Bhai"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                  style={{
                    transform: blink ? 'scaleY(0.98)' : 'scaleY(1)',
                    transition: 'transform 0.15s',
                  }}
                />
              )}
              {isSpeaking && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
                  <div className="h-2 w-12 animate-pulse rounded-full bg-emerald-400/50 blur-sm" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-1 text-center sm:mt-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-md">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-gray-800">Danyal Bhai</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online'}
          </p>
        </div>
      </div>
    </div>
  );
}
