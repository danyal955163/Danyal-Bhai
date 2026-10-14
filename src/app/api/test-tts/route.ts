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

    // Do not return the key, its prefix, personal account data, or raw provider error bodies.
    return NextResponse.json({
      has_key: true,
      user_check: {
        status: response.status,
        ok: response.ok,
        error: response.ok ? null : response.status === 401 ? 'invalid_api_key' : 'provider_request_failed',
      },
    });
  } catch {
    return NextResponse.json({
      has_key: true,
      user_check: { ok: false, error: 'provider_unreachable' },
    });
  }
}
