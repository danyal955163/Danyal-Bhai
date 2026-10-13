import { NextResponse } from 'next/server';

export async function GET() {
  const result: any = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    // Presence and short prefixes help identify the configured deployment variables
    // without returning complete secret values.
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
    openrouter_test: null,
  };

  // Test Groq, the primary chat provider.
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json();
      result.groq_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.groq_test = { error: error.message };
    }
  }

  // Test Mistral, the secondary chat provider.
  if (process.env.MISTRAL_API_KEY) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json();
      result.mistral_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.mistral_test = { error: error.message };
    }
  }

  // Test OpenRouter, the final fallback used by the chat route.
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://danyal-bhai.vercel.app',
          'X-Title': 'Danyal AI',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json();
      result.openrouter_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.openrouter_test = { error: error.message };
    }
  }

  return NextResponse.json(result, { status: 200 });
}
