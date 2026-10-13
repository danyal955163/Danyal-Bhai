import { NextResponse } from 'next/server';

export async function GET() {
  const result: any = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    keys_present: {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      GROQ_LENGTH: process.env.GROQ_API_KEY?.length || 0,
      GROQ_PREFIX: process.env.GROQ_API_KEY?.slice(0, 12) || 'MISSING',
      MISTRAL_API_KEY: !!process.env.MISTRAL_API_KEY,
      MISTRAL_PREFIX: process.env.MISTRAL_API_KEY?.slice(0, 8) || 'MISSING',
      CLOUDFLARE_AI_API_KEY: !!process.env.CLOUDFLARE_AI_API_KEY,
      CLOUDFLARE_PREFIX: process.env.CLOUDFLARE_AI_API_KEY?.slice(0, 8) || 'MISSING',
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      OPENROUTER_PREFIX: process.env.OPENROUTER_API_KEY?.slice(0, 15) || 'MISSING',
    },
    groq_test: null,
    mistral_test: null,
  };

  // TEST GROQ
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
      });
      const data = await res.json();
      result.groq_test = {
        status: res.status,
        ok: res.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error || null,
      };
    } catch (e: any) {
      result.groq_test = { error: e.message };
    }
  }

  // TEST MISTRAL
  if (process.env.MISTRAL_API_KEY) {
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
      });
      const data = await res.json();
      result.mistral_test = {
        status: res.status,
        ok: res.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error || null,
      };
    } catch (e: any) {
      result.mistral_test = { error: e.message };
    }
  }

  return NextResponse.json(result, { status: 200 });
}
