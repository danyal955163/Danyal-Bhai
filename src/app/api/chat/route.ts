import { NextRequest, NextResponse } from 'next/server';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `You are an AI assistant on the website "Danyal AI" (owned by Danyal Bhai).
Reply in the same language as the user's message. Keep replies to 2-4 warm, respectful sentences with no markdown, bullets, or emojis. You are Danyal Bhai's AI assistant. If asked who made the website, say it was made by Danyal Bhai. Never mention AI companies or provider names.`;

async function tryGroq(messages: ChatMessage[]) {
  console.log('Trying Groq...');
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.8, max_tokens: 300 }),
    });
    if (!response.ok) { console.error('Groq HTTP error:', response.status); return null; }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) { console.error('Groq failed:', error); return null; }
}

async function tryMistral(messages: ChatMessage[]) {
  console.log('Trying Mistral...');
  if (!process.env.MISTRAL_API_KEY) return null;
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral-small-latest', messages, temperature: 0.8, max_tokens: 300 }),
    });
    if (!response.ok) { console.error('Mistral HTTP error:', response.status); return null; }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) { console.error('Mistral failed:', error); return null; }
}

async function tryCloudflare(messages: ChatMessage[]) {
  console.log('Trying Cloudflare...');
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!process.env.CLOUDFLARE_AI_API_KEY || !accountId) return null;
  try {
    const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!response.ok) { console.error('Cloudflare HTTP error:', response.status); return null; }
    const data = await response.json();
    return data.result?.response?.trim() || null;
  } catch (error) { console.error('Cloudflare failed:', error); return null; }
}

async function tryOpenRouter(messages: ChatMessage[]) {
  console.log('Trying OpenRouter...');
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://danyal-bhai.vercel.app', 'X-Title': 'Danyal AI' },
      body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages, temperature: 0.8, max_tokens: 300 }),
    });
    if (!response.ok) { console.error('OpenRouter HTTP error:', response.status); return null; }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) { console.error('OpenRouter failed:', error); return null; }
}

export async function POST(request: NextRequest) {
  console.log('=== Chat API Called ===');
  console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
  console.log('MISTRAL_API_KEY exists:', !!process.env.MISTRAL_API_KEY);
  console.log('CLOUDFLARE_AI_API_KEY exists:', !!process.env.CLOUDFLARE_AI_API_KEY);
  console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
  try {
    const { message, history, language, character } = await request.json();
    if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ reply: 'کوئی پیغام لکھیں' }, { status: 400 });
    const characterHint = character === 'teacher' ? ' Act as a patient teacher.' : character === 'friend' ? ' Act as a warm casual friend.' : character === 'guide' ? ' Act as a practical guide.' : '';
    const messages: ChatMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\nSelected language: ${language || 'ur-PK'}.${characterHint}` },
      ...(Array.isArray(history) ? history.slice(-10).filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string').map((item) => ({ role: item.role, content: item.content })) : []),
      { role: 'user', content: message.trim() },
    ];
    let reply = await tryGroq(messages);
    if (!reply) reply = await tryMistral(messages);
    if (!reply) reply = await tryCloudflare(messages);
    if (!reply) reply = await tryOpenRouter(messages);
    return NextResponse.json({ reply: reply || 'معذرت، تمام AI سروسز مصروف ہیں۔ چند لمحے بعد دوبارہ کوشش کریں۔' });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ reply: 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔' }, { status: 500 });
  }
}
