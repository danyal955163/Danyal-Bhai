import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// The system prompt keeps replies short, multilingual, and suitable for speech.
const SYSTEM_PROMPT = `You are an AI assistant on the website "Danyal AI" (owned by Danyal Bhai).
Reply in the same language as the user's message. Keep replies to 2-4 warm, respectful sentences with no markdown, bullets, or emojis. You are Danyal Bhai's AI assistant. If asked who made the website, say it was made by Danyal Bhai. Never mention AI companies or provider names.`;

// Provider helpers return null on any failure so the next provider can be tried.
// This makes temporary outages, quota errors, and missing environment variables non-fatal.

// Groq may retire individual models, so try the fastest current model first and
// continue through the compatibility list if it is unavailable or rate-limited.
const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

// Provider 1: Groq, the primary fast chat provider.
async function tryGroq(messages: ChatMessage[]) {
  if (!process.env.GROQ_API_KEY) {
    console.log('[Groq] API key is missing');
    return null;
  }

  for (const model of GROQ_MODELS) {
    try {
      console.log(`[Groq] Trying model: ${model}`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 300 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Groq] ${model} failed:`, response.status, errorData.error?.message);
        continue;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        console.log(`[Groq] Success with model: ${model}`);
        return reply;
      }
    } catch (error: any) {
      console.error(`[Groq] ${model} exception:`, error.message);
    }
  }

  return null;
}

// Provider 2: Mistral, the secondary fallback.
async function tryMistral(messages: ChatMessage[]) {
  console.log('[Mistral] Attempting request...');
  if (!process.env.MISTRAL_API_KEY) {
    console.log('[Mistral] API key is missing');
    return null;
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'open-mistral-7b',
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('[Mistral] HTTP error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    console.log('[Mistral] Success:', reply?.slice(0, 50));
    return reply || null;
  } catch (error) {
    console.error('[Mistral] Exception:', error);
    return null;
  }
}

// Provider 3: Cloudflare Workers AI, enabled only when both variables are configured.
async function tryCloudflare(messages: ChatMessage[]) {
  console.log('[Cloudflare] Attempting request...');
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!process.env.CLOUDFLARE_AI_API_KEY || !accountId) {
    console.log('[Cloudflare] API key or account ID is missing');
    return null;
  }

  try {
    const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      console.error('[Cloudflare] HTTP error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const reply = data.result?.response?.trim();
    console.log('[Cloudflare] Success:', reply?.slice(0, 50));
    return reply || null;
  } catch (error) {
    console.error('[Cloudflare] Exception:', error);
    return null;
  }
}

// Provider 4: OpenRouter, the final fallback provider.
async function tryOpenRouter(messages: ChatMessage[]) {
  console.log('[OpenRouter] Attempting request...');
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('[OpenRouter] API key is missing');
    return null;
  }

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
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('[OpenRouter] HTTP error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    console.log('[OpenRouter] Success:', reply?.slice(0, 50));
    return reply || null;
  } catch (error) {
    console.error('[OpenRouter] Exception:', error);
    return null;
  }
}

// Main handler: validate the request, build the conversation, then try providers in order.
export async function POST(request: NextRequest) {
  try {
    const { message, history, language, character } = await request.json();

    // Reject empty messages before making any external provider requests.
    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ reply: 'کوئی پیغام لکھیں' }, { status: 400 });
    }

    const characterHint = character === 'teacher'
      ? ' Act as a patient teacher.'
      : character === 'friend'
        ? ' Act as a warm casual friend.'
        : character === 'guide'
          ? ' Act as a practical guide.'
          : '';

    // Limit client-supplied history to the latest ten valid chat messages.
    const safeHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .slice(-10)
          .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string')
          .map((item) => ({ role: item.role, content: item.content }))
      : [];

    const messages: ChatMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\nSelected language: ${language || 'ur-PK'}.${characterHint}` },
      ...safeHistory,
      { role: 'user', content: message.trim() },
    ];

    // Fallback order: a failed provider never prevents the next provider from running.
    let reply = await tryGroq(messages);
    if (!reply) reply = await tryMistral(messages);
    if (!reply) reply = await tryCloudflare(messages);
    if (!reply) reply = await tryOpenRouter(messages);

    if (!reply) {
      console.error('[Chat] All AI providers failed');
      return NextResponse.json({ reply: 'معذرت، تمام AI سروسز مصروف ہیں۔ چند لمحے بعد دوبارہ کوشش کریں۔' });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[Chat] Request error:', error);
    return NextResponse.json({ reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔' }, { status: 500 });
  }
}
