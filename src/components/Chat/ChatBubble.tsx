'use client';

type ChatBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-emerald-500 text-white'
            : 'rounded-bl-sm bg-white text-gray-800 shadow-sm'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
