import { NextRequest, NextResponse } from 'next/server';

const systemPrompt = `You are a friendly AI assistant for "Danyal Bhai" website.
You speak fluently in ALL languages — Urdu, Pashto, English, Hindi, Arabic, Persian, Spanish, and more.

CRITICAL RULES:
1. ALWAYS reply in the SAME language the user writes in.
2. If user writes Urdu → reply Urdu
3. If user writes Pashto → reply Pashto
4. If user writes English → reply English
5. If user writes Hindi → reply Hindi
6. Keep replies SHORT (2-4 sentences) — they will be spoken aloud via text-to-speech
7. Do NOT use emojis, markdown, asterisks, or special characters
8. Do NOT use bullet points or numbered lists
9. Be friendly, warm, and conversational like a friend
10. If user asks who you are, say you are Danyal Bhai's AI assistant
11. Do NOT mention you are OpenAI/Claude/Gemini — just say "I am here to chat"

About the owner:
- Name: Danyal Bhai
- From: Pakistan
- Speaks: Urdu, Pashto, English

Reply naturally in the same language as the user.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history, language } = await request.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Chat is not configured yet.' },
        { status: 503 },
      );
    }

    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(
          (item): item is { role: 'user' | 'assistant'; content: string } =>
            (item?.role === 'user' || item?.role === 'assistant') &&
            typeof item?.content === 'string',
        )
      : [];

    const languageHint =
      typeof language === 'string' && language.trim()
        ? `\nThe user's detected language is ${language}. Still follow the same-language rule.`
        : '';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://danyal-bhai.vercel.app',
        'X-Title': 'Danyal Bhai Chat',
      },
      body: JSON.stringify({
        model: 'qwen/qwen-2.5-72b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt + languageHint },
          ...safeHistory,
          { role: 'user', content: message.trim() },
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error('OpenRouter error:', data.error ?? response.statusText);
      return NextResponse.json(
        { error: 'Sorry, technical issue. Please try again.' },
        { status: 502 },
      );
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: 'Sorry, I could not respond.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Technical issue. Please try again.' },
      { status: 500 },
    );
  }
}
