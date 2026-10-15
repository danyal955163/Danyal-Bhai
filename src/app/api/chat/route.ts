import { NextRequest, NextResponse } from 'next/server';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' } };
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] };

const MAX_IMAGES = 8;
const MAX_TOTAL_IMAGE_CHARS = 3_200_000;

function extractReply(data: any, provider: string): string | null {
  const choice = data.choices?.[0];
  const reply = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
  if (!reply) return null;
  if (choice.finish_reason === 'length' || !/[.!؟?۔]$/u.test(reply)) {
    console.warn(`[${provider}] Reply may be truncated:`, reply.slice(-50));
  }
  return reply;
}

function warnIfReplyMayBeTruncated(reply: string, provider: string) {
  if (!/[.!؟?۔]$/u.test(reply)) {
    console.warn(`[${provider}] Reply may be truncated:`, reply.slice(-50));
  }
}

function removeUnrequestedGreeting(reply: string, message: string, hasPreviousUserTurn: boolean) {
  const userStartedWithGreeting = /^\s*(?:السلام\s*علیکم|سلام|salam)(?=$|[\s،,.!?؟])/iu.test(message);
  if (userStartedWithGreeting && !hasPreviousUserTurn) return reply;

  const withoutLeadingGreeting = reply
    .replace(/^\s*(?:وعلیکم\s*السلام|وعليكم\s*السلام|السلام\s*علیکم|السلام\s*عليكم|سلام|salam|wa\s*alaikum\s*assalam)[!؟۔،,.؛:\s—-]*/iu, '')
    .trim();
  if (withoutLeadingGreeting) return withoutLeadingGreeting;
  if (/[ټډړځڅښږڼګ]/u.test(message)) return 'مهرباني وکړئ خپله پوښتنه لږ نوره روښانه کړئ.';
  if (/[\u0600-\u06FF]/u.test(message)) return 'براہِ کرم اپنا سوال ذرا واضح کریں تاکہ میں مدد کر سکوں۔';
  return 'Please clarify your question so I can help.';
}

const SYSTEM_PROMPT = `You are "Me AI" — a smart, friendly, helpful AI assistant from the Me AI company, created by its owner Danyal Bhai.

CRITICAL RULES:

1. LANGUAGE: Detect the user's language from their latest message and reply ONLY in the required language, without mixing languages. Urdu script → Urdu in Urdu script. Pashto script → Pashto in Pashto script. Latin-script text → English, even when the Latin words are a transliteration of Urdu or Pashto. Follow any explicit per-request language instruction below.
   - For Urdu, use correct Urdu grammar and spelling, natural everyday Pakistani Urdu in Urdu script, clear sentence breaks, and simple spoken phrasing. Avoid Roman Urdu, awkward literal translations, unnecessarily formal Arabic/Persian wording, and English mixing unless needed.
   - For Pashto, use grammatically correct Pashto in Pashto script. A manually selected language for a voice turn takes priority over script guessing.

2. ANSWER EVERYTHING:
   - You are a general-purpose assistant. Help with reasonable questions on any topic, including math, science, history, coding, health, religion, news, advice, jokes, stories, and translations.
   - Do not claim that you can only answer questions about this app or Me AI. The app is secondary context, not a limit on what users may ask.
   - If asked about news, current events, or anything you do not know, be honest that you do not have the latest information, then provide helpful general context where possible. Do not invent current facts.
   - For device or website guidance that depends on visible details, ask the user to attach a screenshot rather than guessing.

3. GREETING RULE:
   - The app already shows one friendly, gender-neutral welcome when a chat starts.
   - Only reply with "وعلیکم السلام" when the user's FIRST message in this chat starts with "السلام علیکم", "Salam", or "سلام".
   - Never begin normal answers with a greeting, and never repeat a greeting in an ongoing conversation. Answer questions directly.

4. HELPING THE USER:
   When asked "how can you help me" or "what can you do", explain in the user's language that you can help with general questions, science, history, math, coding, religion, news background, advice, translation, stories, jokes, Pakistan's history and culture, and questions about this app (voice chat, languages, tasks, coins, and withdrawals). For Urdu, a suitable answer is: "میں آپ کی کئی معاملات میں مدد کر سکتا ہوں: سائنس، تاریخ، ریاضی، کوڈنگ، مذہب، عام معلومات، مشورے، ترجمہ، کہانیاں، لطیفے اور پاکستان کی تاریخ و ثقافت۔ میں اس ایپ کے استعمال، ٹاسکس، کوائنز اور نکالنے کے طریقے کے بارے میں بھی رہنمائی کر سکتا ہوں۔" Mention image reading only when that feature is available.

5. ABOUT THE APP (secondary context):
   - The company name and AI name are Me AI.
   - The owner is Danyal Bhai, a Pathan (پٹھان) from Charsadda Tangi, Pakistan (چارسدہ تنگی).
   - If asked about app features, explain relevant features such as tasks and coins, voice chat, multiple languages, and image reading when available.

6. IDENTITY:
   - Your name is Me AI.
   - If asked who made you ("کس نے بنایا"), reply in Urdu: "مجھے دانیال بھائی نے بنایا ہے۔ وہ پٹھان ہیں اور چارسدہ تنگی کے رہنے والے ہیں۔" In another language, give the same facts in that language.
   - If asked who owns you or who your owner is ("owner کون ہے"), reply in Urdu: "میرے مالک دانیال بھائی ہیں۔ وہ پٹھان ہیں اور چارسدہ تنگی کے رہنے والے ہیں۔" In another language, give the same facts in that language.
   - If asked what your company is ("کمپنی کیا ہے"), reply: "میری کمپنی Me AI ہے، جس کے مالک دانیال بھائی ہیں۔"
   - If asked "Who is Danyal Bhai?", explain in the user's language that he owns Me AI, is Pathan, and is from Charsadda Tangi, Pakistan.
   - If asked "Who are you?", reply in Urdu: "میں Me AI ہوں، ایک AI اسسٹنٹ۔ مجھے دانیال بھائی نے بنایا ہے۔" In another language, answer in that language.

7. STYLE:
   - Use 2-4 sentences for short answers, and give more detail when the user needs it.
   - No emojis, asterisks, or markdown.
   - Be direct, helpful, and warm. Answer the actual question.

8. Do not mention AI companies or model providers.

NOW ANSWER THE USER'S QUESTION DIRECTLY AND HELPFULLY.`;

const FEW_SHOT_EXAMPLES: ChatMessage[] = [
  { role: 'user', content: 'What is 2+2?' },
  { role: 'assistant', content: '2+2 equals 4.' },
  { role: 'user', content: 'Kaisay ho?' },
  { role: 'assistant', content: 'I am doing well, thank you. How can I help you?' },
  { role: 'user', content: 'پاکستان کا دارالحکومت کیا ہے؟' },
  { role: 'assistant', content: 'اسلام آباد پاکستان کا دارالحکومت ہے۔' },
  { role: 'user', content: 'زه څنګه مرسته غوښتلی شم؟' },
  { role: 'assistant', content: 'تاسو خپله پوښتنه راسره شریکه کړئ، زه به مرسته وکړم.' },
  { role: 'user', content: 'What is a computer?' },
  { role: 'assistant', content: 'A computer is an electronic device that processes information and runs programs.' },
  { role: 'user', content: 'Tell me a short joke.' },
  { role: 'assistant', content: 'Why did the math book look sad? It had too many problems.' },
];

const WELCOME_MESSAGES = new Set([
  'السلام علیکم! آپ کیسے ہیں؟ بتائیے، آج میں آپ کی کس طرح مدد کروں؟',
  'Hello, how can I help you today?',
  'السلام علیکم، څنګه مرسته درسره کولی شم؟',
]);

function imageUnavailableMessage(language: unknown) {
  if (typeof language === 'string' && language.startsWith('en')) {
    return 'Image reading is temporarily unavailable. Please try again shortly.';
  }
  if (typeof language === 'string' && language.startsWith('ps')) {
    return 'د انځور لوستل اوس مهال شتون نه لري. لږ وروسته بیا هڅه وکړئ.';
  }
  return 'تصاویر پڑھنے کی سہولت عارضی طور پر دستیاب نہیں۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔';
}

function localizedMessage(key: 'invalidImages' | 'tooManyImages' | 'invalidImage' | 'imagesTooLarge' | 'emptyMessage' | 'invalidFormat' | 'providersFailed' | 'technicalError', language: 'ur-PK' | 'en-US' | 'ps-AF') {
  const messages: Record<typeof key, Record<'ur-PK' | 'en-US' | 'ps-AF', string>> = {
    invalidImages: {
      'ur-PK': 'تصاویر کا فارمیٹ درست نہیں ہے۔',
      'en-US': 'The image list has an invalid format.',
      'ps-AF': 'د انځورونو لېست ناسم دی.',
    },
    tooManyImages: {
      'ur-PK': `ایک وقت میں زیادہ سے زیادہ ${MAX_IMAGES} تصاویر بھیجیں۔`,
      'en-US': `Send no more than ${MAX_IMAGES} images at a time.`,
      'ps-AF': `په یو ځل تر ${MAX_IMAGES} ډېر انځورونه مه لېږئ.`,
    },
    invalidImage: {
      'ur-PK': 'تصویر کا فارمیٹ درست نہیں ہے۔',
      'en-US': 'An image has an invalid format.',
      'ps-AF': 'د انځور بڼه ناسمه ده.',
    },
    imagesTooLarge: {
      'ur-PK': 'تصاویر مجموعی طور پر بہت بڑی ہیں۔ چھوٹی تصاویر یا کم تصاویر بھیجیں۔',
      'en-US': 'The images are too large in total. Try smaller or fewer images.',
      'ps-AF': 'انځورونه په ټوله کې ډېر لوی دي. واړه یا لږ انځورونه وکاروئ.',
    },
    emptyMessage: {
      'ur-PK': 'کوئی پیغام لکھیں۔',
      'en-US': 'Please enter a message.',
      'ps-AF': 'مهرباني وکړئ یو پیغام ولیکئ.',
    },
    invalidFormat: {
      'ur-PK': 'صرف JPG، PNG، WebP یا GIF تصویر بھیجیں۔',
      'en-US': 'Please send a JPG, PNG, WebP, or GIF image.',
      'ps-AF': 'JPG، PNG، WebP یا GIF انځور راولېږئ.',
    },
    providersFailed: {
      'ur-PK': 'معذرت، تمام AI سروسز عارضی طور پر مصروف ہیں۔ چند لمحے بعد دوبارہ کوشش کریں۔',
      'en-US': 'Sorry, all AI services are temporarily busy. Please try again in a moment.',
      'ps-AF': 'بښنه غواړو، د AI ټول خدمتونه لنډمهاله بوخت دي. لږ وروسته بیا هڅه وکړئ.',
    },
    technicalError: {
      'ur-PK': 'معذرت، تکنیکی مسئلہ ہے۔ دوبارہ کوشش کریں۔',
      'en-US': 'Sorry, a technical error occurred. Please try again.',
      'ps-AF': 'بښنه غواړو، تخنیکي ستونزه رامنځته شوه. بیا هڅه وکړئ.',
    },
  };
  return messages[key][language];
}

const GROQ_MODELS = ['qwen/qwen3.8-27b'];
const GROQ_MAX_IMAGES_PER_REQUEST = 3;

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
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 500 }),
  });

  try {
    console.log('[OpenAI] Trying gpt-4o-mini...');
    let response = await requestModel('gpt-4o-mini');

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
    const reply = extractReply(data, 'OpenAI');
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
        body: JSON.stringify({ model, messages, temperature: 0.8, max_completion_tokens: 500 }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Groq] ${model} failed:`, response.status, errorData.error?.message);
        continue;
      }

      const data = await response.json();
      const reply = extractReply(data, 'Groq');
      if (reply) return reply;
    } catch (error: any) {
      console.error(`[Groq] ${model} exception:`, error?.message || error);
    }
  }

  return null;
}

async function tryGroqVision(messages: ChatMessage[]): Promise<string | null> {
  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== 'user' || !Array.isArray(latest.content)) return null;

  const textParts = latest.content.filter((part): part is Extract<ContentPart, { type: 'text' }> => part.type === 'text');
  const imageParts = latest.content.filter((part): part is Extract<ContentPart, { type: 'image_url' }> => part.type === 'image_url');
  if (imageParts.length === 0) return null;

  const replies: string[] = [];
  for (let index = 0; index < imageParts.length; index += GROQ_MAX_IMAGES_PER_REQUEST) {
    const batchMessages: ChatMessage[] = [
      ...messages.slice(0, -1),
      {
        role: 'user',
        content: [
          ...textParts,
          ...imageParts.slice(index, index + GROQ_MAX_IMAGES_PER_REQUEST).map((part): ContentPart => ({
            type: 'image_url',
            image_url: { url: part.image_url.url, detail: 'low' },
          })),
        ],
      },
    ];
    const groqMessages: ChatMessage[] = batchMessages.map((message) => ({
      ...message,
      content: Array.isArray(message.content)
        ? message.content.map((part) => part.type === 'image_url'
          ? { type: 'image_url' as const, image_url: { url: part.image_url.url } }
          : part)
        : message.content,
    }));
    const reply = await tryGroq(groqMessages);
    if (!reply) return null;
    replies.push(reply);
  }

  return replies.join('\n');
}

function toMistralMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: Array.isArray(message.content)
      ? message.content.map((part) => part.type === 'text'
        ? { type: 'text' as const, text: part.text }
        : { type: 'image_url' as const, image_url: part.image_url.url })
      : message.content,
  }));
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
        model: 'mistral-small-latest',
        messages: toMistralMessages(messages),
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('[Mistral] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return extractReply(data, 'Mistral');
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
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('[OpenRouter] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    return extractReply(data, 'OpenRouter');
  } catch (error: any) {
    console.error('[OpenRouter] Exception:', error?.message || error);
    return null;
  }
}

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
      body: JSON.stringify({ messages, max_tokens: 500 }),
    });

    if (!response.ok) {
      console.error('[Cloudflare] Request failed:', response.status);
      return null;
    }

    const data = await response.json();
    const reply = data.result?.response?.trim() || '';
    if (reply) warnIfReplyMayBeTruncated(reply, 'Cloudflare');
    return reply || null;
  } catch (error: any) {
    console.error('[Cloudflare] Exception:', error?.message || error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let responseLanguage: 'ur-PK' | 'en-US' | 'ps-AF' = 'ur-PK';
  try {
    const { message, history, language, languageLocked, character, imageBase64, images: incomingImages } = await request.json();
    const selectedLanguage = language === 'ps-AF' ? 'ps-AF' : language === 'en-US' ? 'en-US' : 'ur-PK';
    responseLanguage = selectedLanguage;
    const images: unknown = incomingImages === undefined
      ? imageBase64 === undefined ? [] : [imageBase64]
      : incomingImages;

    if (!Array.isArray(images)) {
      return NextResponse.json({ reply: localizedMessage('invalidImages', responseLanguage) }, { status: 400 });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json({ reply: localizedMessage('tooManyImages', responseLanguage) }, { status: 400 });
    }
    if (images.some((image) => typeof image !== 'string')) {
      return NextResponse.json({ reply: localizedMessage('invalidImage', responseLanguage) }, { status: 400 });
    }
    const imageDataUrls = images as string[];
    if (imageDataUrls.reduce((total, image) => total + image.length, 0) > MAX_TOTAL_IMAGE_CHARS) {
      return NextResponse.json({ reply: localizedMessage('imagesTooLarge', responseLanguage) }, { status: 413 });
    }
    if (typeof message !== 'string' || (!message.trim() && imageDataUrls.length === 0)) {
      return NextResponse.json({ reply: localizedMessage('emptyMessage', responseLanguage) }, { status: 400 });
    }

    const containsArabicScript = /[\u0600-\u06FF]/u.test(message);
    const replyLanguage = languageLocked === true
      ? selectedLanguage
      : containsArabicScript
        ? (/[ټډړځڅښږڼګ]/u.test(message) || selectedLanguage === 'ps-AF' ? 'ps-AF' : 'ur-PK')
        : message.trim() ? 'en-US' : selectedLanguage;
    const languageInstruction = replyLanguage === 'ps-AF'
      ? ' Reply only in Pashto using Pashto script.'
      : replyLanguage === 'ur-PK'
        ? ' Reply only in Urdu using Urdu script.'
        : ' Reply only in English.';

    for (const image of imageDataUrls) {
      if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(image)) {
        return NextResponse.json({ reply: localizedMessage('invalidFormat', responseLanguage) }, { status: 400 });
      }
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
          .slice(-8)
          .filter((item) =>
            (item?.role === 'user' || item?.role === 'assistant') &&
            typeof item?.content === 'string' &&
            !(item.role === 'assistant' && WELCOME_MESSAGES.has(item.content.trim())),
          )
          .map((item) => ({ role: item.role, content: item.content }))
      : [];

    const userContent: string | ContentPart[] = imageDataUrls.length
      ? [
          { type: 'text', text: message.trim() || 'Please read and describe these images.' },
          ...imageDataUrls.map((url): ContentPart => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
        ]
      : message.trim();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}${languageInstruction}${characterHint}`,
      },
      ...FEW_SHOT_EXAMPLES,
      ...safeHistory,
      { role: 'user', content: userContent },
    ];

    let reply = await tryOpenAI(messages);
    if (imageDataUrls.length > 0) {
      if (!reply) reply = await tryMistral(messages);
      if (!reply) reply = await tryGroqVision(messages);
      if (!reply) reply = await tryOpenRouter(messages);
      if (!reply) reply = imageUnavailableMessage(replyLanguage);
    } else if (!reply) {
      reply = await tryGroq(messages);
      if (!reply) reply = await tryMistral(messages);
      if (!reply) reply = await tryOpenRouter(messages);
      if (!reply) reply = await tryCloudflare(messages);
    }

    if (!reply) {
      console.error('[Chat] All AI providers failed');
      return NextResponse.json({ reply: localizedMessage('providersFailed', responseLanguage) });
    }

    const finalReply = removeUnrequestedGreeting(reply, message.trim(), safeHistory.some((item) => item.role === 'user'));
    return NextResponse.json({ reply: finalReply });
  } catch (error: any) {
    console.error('[Chat] Request error:', error?.message || error);
    return NextResponse.json({ reply: localizedMessage('technicalError', responseLanguage) }, { status: 500 });
  }
}
