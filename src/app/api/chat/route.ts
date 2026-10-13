import { NextRequest, NextResponse } from 'next/server';

const MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
];

const systemPrompt = `You are the AI assistant representing Danyal Bhai, owner of this website.

CRITICAL RULES:
1. LANGUAGE: Always reply in the SAME language the user writes in.
   - Urdu → Urdu
   - English → English
   - Pashto → Pashto
   - Punjabi → Punjabi
   - Sindhi → Sindhi
   - Hindi → Hindi
   - Arabic → Arabic

2. IDENTITY: You are Danyal Bhai's AI assistant.
   - If asked who are you, say: "میں دانیال بھائی کا AI اسسٹنٹ ہوں، آپ کی مدد کے لیے حاضر ہوں"
   - If asked who made this website, say: "یہ ویب سائٹ دانیال بھائی نے بنائی ہے"
   - If asked who is Danyal Bhai, say: "وہ میری ویب سائٹ کے مالک ہیں، پاکستان سے ہیں"

3. STYLE:
   - Short replies (2-4 sentences) because they will be spoken aloud
   - No emojis, no markdown, no asterisks, no bullet points
   - Warm, friendly, respectful tone
   - Pakistani cultural context

4. If user says Salam or السلام علیکم, reply: "وعلیکم السلام، کیسے ہیں آپ؟"
5. Never mention OpenAI, Google, Anthropic, or any AI company.

Reply now in the same language as the user.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history, language } = await request.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not configured');
      return NextResponse.json(
        { reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔', error: 'OPENROUTER_API_KEY is not configured' },
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
    const languageHint = typeof language === 'string' && language.trim()
      ? `\nThe selected response language is ${language}. Still follow the same-language rule.`
      : '';
    const messages = [
      { role: 'system' as const, content: systemPrompt + languageHint },
      ...safeHistory,
      { role: 'user' as const, content: message.trim() },
    ];
    const headers = {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://danyal-bhai.vercel.app',
      'X-Title': 'Danyal Bhai Chat',
    };

    for (const model of MODELS) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 300 }),
        });
        const data = await response.json();
        console.log('OpenRouter response:', JSON.stringify({ model, status: response.status, data }));

        if (!response.ok) {
          console.error('OpenRouter HTTP error:', response.status, data);
          continue;
        }
        if (data.error) {
          console.error('OpenRouter error:', data.error);
          continue;
        }
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) return NextResponse.json({ reply });
        console.error(`Model ${model} returned an empty response`);
      } catch (error) {
        console.error(`Model ${model} failed:`, error);
      }
    }

    return NextResponse.json(
      { reply: 'معذرت، ابھی جواب نہیں دے سکتا۔ دوبارہ کوشش کریں۔', error: 'All OpenRouter models failed' },
      { status: 502 },
    );
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
