import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string; image?: string };

const SYSTEM_PROMPT = `You are an AI assistant on the website "Danyal AI" (owned by Danyal Bhai).

CRITICAL RULES:
1. LANGUAGE: Always reply in the SAME language the user writes in: Urdu, English, Pashto, Punjabi, Sindhi, Hindi, Arabic, or Persian.
2. IDENTITY: You are Danyal Bhai's AI assistant. If asked who you are, say "میں دانیال بھائی کا AI اسسٹنٹ ہوں" in Urdu or matching language. If asked who made this website, say "یہ ویب سائٹ دانیال بھائی نے بنائی ہے". If asked who is Danyal Bhai, say "وہ اس ویب سائٹ کے مالک ہیں، پاکستان سے ہیں".
3. STYLE: Use 2-4 sentences only, with no emojis, asterisks, bullet points, or markdown. Be warm, respectful, friendly, and gender-neutral. Avoid using "بھائی" when greeting users.
4. GREETING: If user says Salam or السلام علیکم, reply "وعلیکم السلام، میں دانیال AI ہوں، آپ کی کیا مدد کر سکتا ہوں؟"
5. Never mention OpenAI, Google, Anthropic, Groq, or any AI company.

Reply in the same language as the user's message.`;

async function tryGroq(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: messages.map(({ role, content }) => ({ role, content })), temperature: 0.8, max_tokens: 300 }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Groq failed:', error);
    return null;
  }
}

async function tryGemini(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const systemMsg = messages.find((message) => message.role === 'system')?.content || '';
    const chatMsgs = messages.filter((message) => message.role !== 'system');
    const contents = chatMsgs.map((message) => {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: message.content }];
      if (message.image?.startsWith('data:')) {
        const match = message.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
      return { role: message.role === 'assistant' ? 'model' : 'user', parts };
    });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemMsg }] }, generationConfig: { temperature: 0.8, maxOutputTokens: 300 } }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (error) {
    console.error('Gemini failed:', error);
    return null;
  }
}

async function tryOpenRouter(messages: ChatMessage[]): Promise<string | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://danyal-bhai.vercel.app', 'X-Title': 'Danyal AI' },
      body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages: messages.map(({ role, content }) => ({ role, content })), temperature: 0.8, max_tokens: 300 }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('OpenRouter failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, language, character, image } = await request.json();
    if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ reply: 'کوئی پیغام لکھیں' }, { status: 400 });

    const safeHistory = Array.isArray(history) ? history.slice(-10).filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string').map((item) => ({ role: item.role, content: item.content })) : [];
    const languageHint = typeof language === 'string' ? `\nThe selected language is ${language}.` : '';
    const characterHint = character === 'teacher'
      ? '\nAct as a patient teacher and explain concepts clearly.'
      : character === 'friend'
        ? '\nAct as a warm, casual friend while remaining respectful.'
        : character === 'guide'
          ? '\nAct as a practical guide and focus on helpful next steps.'
          : '';
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT + languageHint + characterHint },
      ...safeHistory,
      { role: 'user', content: message.trim(), image: typeof image === 'string' ? image : undefined },
    ];

    let reply = await tryGroq(messages);
    if (!reply) { console.log('Groq failed, trying Gemini...'); reply = await tryGemini(messages); }
    if (!reply) { console.log('Gemini failed, trying OpenRouter...'); reply = await tryOpenRouter(messages); }
    if (!reply) return NextResponse.json({ reply: 'معذرت، تمام AI سروسز مصروف ہیں۔ چند لمحے بعد دوبارہ کوشش کریں۔' });
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔' });
  }
}
