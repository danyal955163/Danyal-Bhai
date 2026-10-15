'use client';

import { useEffect, useState } from 'react';

interface AvatarProps {
  photoUrl: string;
  isSpeaking: boolean;
  isListening: boolean;
}

export default function Avatar({ photoUrl, isSpeaking, isListening }: AvatarProps) {
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
    <div className="relative flex h-full w-full items-center justify-center overflow-visible">
      {isSpeaking && <div aria-hidden="true" className="avatar-speaking-ring pointer-events-none absolute left-1/2 top-[42%] h-[min(88vw,25rem)] w-[min(88vw,25rem)] -translate-x-1/2 -translate-y-1/2 rounded-full" />}
      {isListening && <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 animate-pulse whitespace-nowrap rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">Listening...</div>}

      <div className="relative flex max-h-full flex-col items-center justify-center">
        <div className={`relative ${isSpeaking ? 'avatar-speaking' : isListening ? 'avatar-listening' : 'avatar-idle'}`}>
          <div className={`relative h-72 w-72 max-h-[calc(50vh-5rem)] max-w-[88vw] overflow-hidden rounded-full border-4 border-white bg-white shadow-2xl sm:h-80 sm:w-80 ${isSpeaking ? 'ring-8 ring-emerald-400/40' : isListening ? 'ring-8 ring-sky-400/35' : 'ring-4 ring-white'}`}>
            {imageFailed ? (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-300 to-yellow-600 text-8xl font-black text-white">M</div>
            ) : (
              <img
                src={photoUrl}
                alt="Me AI assistant"
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
                style={{ transform: blink ? 'scaleY(0.98)' : 'scaleY(1)', transition: 'transform 0.15s' }}
              />
            )}
          </div>
          {isSpeaking && (
            <div aria-label="Speaking" role="status" className="absolute -bottom-5 left-1/2 z-10 flex h-8 -translate-x-1/2 items-end gap-1 rounded-full bg-white/90 px-3 py-1 shadow-md">
              {[0.45, 0.75, 1, 0.62, 0.9].map((height, index) => (
                <span key={index} className="avatar-equalizer w-1.5 rounded-full bg-emerald-500" style={{ '--bar-height': `${height * 100}%`, animationDelay: `${index * 90}ms` } as React.CSSProperties} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center sm:mt-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-md">
            <div className={`h-2 w-2 rounded-full ${isSpeaking ? 'animate-pulse bg-emerald-500' : isListening ? 'animate-pulse bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-sm font-bold text-gray-800">Me AI</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Online'}</p>
        </div>
      </div>
    </div>
  );
}
