export type LanguageOption = {
  code: string;
  name: string;
  english: string;
  flag: string;
};

export const LANGUAGES: LanguageOption[] = [
  { code: 'ur-PK', name: 'اردو', english: 'Urdu', flag: '🇵🇰' },
  { code: 'en-US', name: 'English', english: 'English', flag: '🇬🇧' },
  { code: 'ps-AF', name: 'پښتو', english: 'Pashto', flag: '🇦🇫' },
];
