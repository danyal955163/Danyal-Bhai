import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `You are "Me AI" — a friendly AI assistant on the Danyal-Bhai website, created by Danyal Bhai.

CRITICAL RULES:
1. Always reply in the same language the user writes in: Urdu, English, Pashto, Punjabi, Sindhi, Hindi, Arabic, or Persian.
2. Keep replies to 2-4 short sentences, suitable for text-to-speech.
3. Do not use emojis, asterisks, bullet points, or markdown.
4. Use a warm, respectful, friendly tone and gender-neutral greetings.
5. If asked who you are, say: "میں می AI ہوں، دانیال بھائی کا بنایا ہوا AI اسسٹنٹ".
6. If asked who made the website, say: "یہ ویب سائٹ دانیال بھائی نے بنائی ہے".
7. If asked who Danyal Bhai is, say: "وہ اس ویب سائٹ کے مالک ہیں، پاکستان سے ہیں".
8. If the user says "Salam" or "السلام علیکم", reply: "وعلیکم السلام! میں می AI ہوں، آپ کی کیا مدد کر سکتا ہوں؟"
9. Never mention OpenAI, Google, Groq, Mistral, Cloudflare, OpenRouter, or any AI company/provider.`;

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'gemma2-9b-it',
];

async function tryOpenAI(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[OpenAI] API key is missing');
    return null;
  }

  const requestModel = async (model: string) => fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 300 }),
  });

  try {
    console.log('[OpenAI] Trying gpt-4o-mini...');
    let response = await requestModel('gpt-4o-mini');

    // Keep the requested compatibility fallback for accounts where the model is unavailable.
    if (response.status === 404) {
      console.log('[OpenAI] gpt-4o-mini unavailable; trying gpt-3.5-turbo...');
      response = await requestModel('gpt-3.5-turbo');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI] Request failed:', response.status, errorData.error?.message);
      return null;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) console.log('[OpenAI] Request succeeded');
    return reply || null;
  } catch (error: any) {
    console.error('[OpenAI] Exception:', error?.message || error);
    return null;
  }
}

async function tryGroq(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null;

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
      if (reply) return reply;
    } catch (error: any) {
      console.error(`[Groq] ${model} exception:`, error?.message || error);
    }
  }

  return null;
}

async function tryMistral(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.MISTRAL_API_KEY) return null;

  try {
    console.log('[Mistral] Trying...');
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
      console.error('[Mistral] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error: any) {
    console.error('[Mistral] Exception:', error?.message || error);
    return null;
  }
}

async function tryOpenRouter(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;

  try {
    console.log('[OpenRouter] Trying...');
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
        messages,
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('[OpenRouter] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error: any) {
    console.error('[OpenRouter] Exception:', error?.message || error);
    return null;
  }
}

// Retain the project's existing Cloudflare option as an additional last-resort fallback.
async function tryCloudflare(messages: ChatMessage[]): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = process.env.CLOUDFLARE_AI_API_KEY;
  if (!apiKey || !accountId) return null;

  try {
    const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      console.error('[Cloudflare] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.result?.response?.trim() || null;
  } catch (error: any) {
    console.error('[Cloudflare] Exception:', error?.message || error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, language, character } = await request.json();

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

    const safeHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .slice(-10)
          .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string')
          .map((item) => ({ role: item.role, content: item.content }))
      : [];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\nSelected language preference: ${typeof language === 'string' ? language : 'ur-PK'}.${characterHint}`,
      },
      ...safeHistory,
      { role: 'user', content: message.trim() },
    ];

    // OpenAI is primary. Existing providers remain available if it is missing, limited, or unavailable.
    let reply = await tryOpenAI(messages);
    if (!reply) reply = await tryGroq(messages);
    if (!reply) reply = await tryMistral(messages);
    if (!reply) reply = await tryOpenRouter(messages);
    if (!reply) reply = await tryCloudflare(messages);

    if (!reply) {
      console.error('[Chat] All AI providers failed');
      return NextResponse.json({
        reply: 'معذرت، تمام AI سروسز عارضی طور پر مصروف ہیں۔ چند لمحے بعد دوبارہ کوشش کریں۔',
      });
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Chat] Request error:', error?.message || error);
    return NextResponse.json({ reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔' }, { status: 500 });
  }
}
