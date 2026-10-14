import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ has_key: false, user_check: null });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    // This checks account-read access only. Restricted speech-only keys can receive 401 here
    // and still successfully synthesize audio through /v1/text-to-speech.
    return NextResponse.json({
      has_key: true,
      account_check: {
        status: response.status,
        ok: response.ok,
        error: response.ok ? null : response.status === 401 ? 'account_endpoint_unauthorized_or_key_restricted' : 'provider_request_failed',
      },
      speech_check: 'not_tested',
    });
  } catch {
    return NextResponse.json({
      has_key: true,
      account_check: { ok: false, error: 'provider_unreachable' },
      speech_check: 'not_tested',
    });
  }
}
