import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'pNInz6obpgDQGcFmaJgB' } = await request.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text is too long for speech synthesis' }, { status: 413 });
    }

    const selectedVoiceId = typeof voiceId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(voiceId)
      ? voiceId
      : 'pNInz6obpgDQGcFmaJgB';
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs is not configured', code: 'NO_API_KEY' },
        { status: 503 },
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );

    if (!response.ok) {
      console.error('[TTS] ElevenLabs request failed:', response.status);
      return NextResponse.json({ error: 'ElevenLabs speech synthesis failed' }, { status: 502 });
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[TTS] Request error:', error?.message || error);
    return NextResponse.json({ error: 'Speech synthesis failed' }, { status: 500 });
  }
}
