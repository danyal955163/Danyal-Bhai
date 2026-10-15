import { EdgeTTS } from '@andresaya/edge-tts';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 5_000;
const VOICES: Record<string, string> = {
  'ur-PK': 'ur-PK-AsadNeural',
  'en-US': 'en-US-GuyNeural',
  'ps-AF': 'ps-AF-GulNawazNeural',
};

function normalizeUrduSpeech(text: string) {
  return text
    .normalize('NFC')
    .replace(/\u0640/gu, '')
    .replace(/[\u064A\u0649]/gu, 'ی')
    .replace(/\u0643/gu, 'ک')
    .replace(/\s+/gu, ' ')
    .trim();
}

function getSafeErrorDetails(error: unknown) {
  if (typeof error !== 'object' || error === null) return { name: typeof error };
  const details = error as Record<string, unknown>;
  return {
    name: typeof details.name === 'string' ? details.name.slice(0, 80) : 'UnknownError',
    code: typeof details.code === 'string' ? details.code.slice(0, 80) : undefined,
    status: typeof details.status === 'number' ? details.status : undefined,
  };
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'A valid JSON request body is required' }, { status: 400 });
  }

  if (typeof payload !== 'object' || payload === null || !('text' in payload)) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  const { text, language, voiceTone } = payload as { text?: unknown; language?: unknown; voiceTone?: unknown };
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Text is too long for speech synthesis' }, { status: 413 });
  }

  const requestedLanguage = typeof language === 'string' && Object.prototype.hasOwnProperty.call(VOICES, language) ? language : 'en-US';
  const requestedTone = voiceTone === 'natural' ? 'natural' : 'deep';
  const voice = VOICES[requestedLanguage];
  const speechText = requestedLanguage === 'ur-PK' ? normalizeUrduSpeech(text) : text.trim();
  const rate = requestedTone === 'deep' ? '-4%' : '-5%';
  const pitch = requestedTone === 'deep' ? '-8Hz' : '-2Hz';

  try {
    const tts = new EdgeTTS();
    await tts.synthesize(speechText, voice, {
      rate,
      pitch,
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      timeout: 30_000,
    });

    const audioBuffer = await tts.toBuffer();
    if (!audioBuffer.byteLength) {
      throw new Error('The speech service returned empty audio');
    }

    const audioBody = Uint8Array.from(audioBuffer);
    return new NextResponse(audioBody, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const requestId = request.headers.get('x-vercel-id') ?? request.headers.get('x-request-id') ?? 'unavailable';
    console.error('[Edge-TTS] Synthesis failed', {
      requestId,
      language: requestedLanguage,
      voice,
      error: getSafeErrorDetails(error),
    });
    return NextResponse.json(
      { error: 'Speech synthesis is temporarily unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } },
    );
  }
}
