import { NextResponse } from 'next/server';

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'gemma2-9b-it',
];

export async function GET() {
  const result: any = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    // Presence and short prefixes help identify configured deployment variables without returning full secrets.
    keys_present: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_PREFIX: process.env.OPENAI_API_KEY?.slice(0, 10) || 'MISSING',
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
    openai_test: null,
    groq_test: {
      models_tried: [],
      succeeded_model: null,
      attempts: [],
    },
    mistral_test: null,
    openrouter_test: null,
  };

  // Test OpenAI first because it is the primary chat provider.
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json().catch(() => ({}));
      result.openai_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.openai_test = { error: error?.message || String(error) };
    }
  }

  // Test each configured Groq model until one responds successfully.
  if (process.env.GROQ_API_KEY) {
    for (const model of GROQ_MODELS) {
      result.groq_test.models_tried.push(model);
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Reply with: OK' }],
            max_tokens: 5,
          }),
        });
        const data = await response.json().catch(() => ({}));
        const attempt = {
          model,
          status: response.status,
          ok: response.ok,
          response: data.choices?.[0]?.message?.content || null,
          error: data.error || null,
        };
        result.groq_test.attempts.push(attempt);
        if (response.ok && attempt.response) {
          result.groq_test.succeeded_model = model;
          break;
        }
      } catch (error: any) {
        result.groq_test.attempts.push({ model, error: error?.message || String(error) });
      }
    }
  }

  if (process.env.MISTRAL_API_KEY) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'open-mistral-7b',
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json().catch(() => ({}));
      result.mistral_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.mistral_test = { error: error?.message || String(error) };
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://danyal-bhai.vercel.app',
          'X-Title': 'Me AI',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'user', content: 'Reply with: OK' }],
          max_tokens: 5,
        }),
      });
      const data = await response.json().catch(() => ({}));
      result.openrouter_test = {
        status: response.status,
        ok: response.ok,
        response: data.choices?.[0]?.message?.content || null,
        error: data.error?.message || null,
      };
    } catch (error: any) {
      result.openrouter_test = { error: error?.message || String(error) };
    }
  }

  return NextResponse.json(result, { status: 200 });
}
