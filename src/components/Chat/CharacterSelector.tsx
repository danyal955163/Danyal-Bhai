'use client';

import { Check, Users } from 'lucide-react';
import { useState } from 'react';

export const CHARACTERS = [
  { id: 'danyal', name: 'دانیال AI', english: 'Danyal AI', emoji: '🧑', description: 'Main assistant', voicePitch: 0.85 },
  { id: 'teacher', name: 'اُستاد', english: 'Teacher', emoji: '👨‍🏫', description: 'Teaches everything', voicePitch: 0.9 },
  { id: 'friend', name: 'دوست', english: 'Friend', emoji: '🤝', description: 'Casual chat', voicePitch: 0.95 },
  { id: 'guide', name: 'گائیڈ', english: 'Guide', emoji: '🧭', description: 'Helps you find things', voicePitch: 0.85 },
];

export default function CharacterSelector({
  current,
  onChange,
}: {
  current: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentCharacter = CHARACTERS.find((character) => character.id === current) ?? CHARACTERS[0];

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100" aria-label="Choose character">
        <Users size={14} /><span>{currentCharacter.emoji}</span><span className="hidden sm:inline">{currentCharacter.name}</span>
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close character menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            {CHARACTERS.map((character) => (
              <button type="button" key={character.id} onClick={() => { onChange(character.id); setOpen(false); }} className={`flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${current === character.id ? 'bg-purple-50' : ''}`}>
                <div className="flex items-start gap-2"><span className="text-lg">{character.emoji}</span><div><div className={`font-semibold ${current === character.id ? 'text-purple-700' : 'text-gray-800'}`}>{character.name}</div><div className="text-[10px] text-gray-400">{character.description}</div></div></div>
                {current === character.id && <Check size={14} className="mt-1 text-purple-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
