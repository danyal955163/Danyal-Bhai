'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Menu, MessageSquare, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Conversation = {
  id: string;
  created_at: string;
  language: string | null;
  title: string;
};

function makeTitle(text: string) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Chat';
  return normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized;
}

export default function ChatSidebar({
  open,
  onClose,
  currentConversationId,
  onNewChat,
  onSelectConversation,
}: {
  open: boolean;
  onClose: () => void;
  currentConversationId?: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string, language?: string | null) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (authError || !user) {
        if (!cancelled) {
          setError('Sign in to view saved chats.');
          setLoading(false);
        }
        return;
      }

      const { data: rows, error: conversationError } = await supabase
        .from('conversations')
        .select('id, created_at, language')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (conversationError) {
        console.error('Could not load conversations:', conversationError);
        if (!cancelled) {
          setError('Could not load chat history.');
          setLoading(false);
        }
        return;
      }

      const ids = (rows ?? []).map((row) => row.id as string);
      const titles = new Map<string, string>();
      if (ids.length) {
        const { data: messageRows, error: messageError } = await supabase
          .from('messages')
          .select('conversation_id, role, content, created_at')
          .eq('user_id', user.id)
          .in('conversation_id', ids)
          .order('created_at', { ascending: true })
          .limit(300);
        if (messageError) console.error('Could not load conversation titles:', messageError);
        for (const row of messageRows ?? []) {
          if (row.role === 'user' && typeof row.content === 'string' && !titles.has(row.conversation_id)) {
            titles.set(row.conversation_id, makeTitle(row.content));
          }
        }
      }

      if (!cancelled) {
        setConversations((rows ?? []).map((row) => ({
          id: row.id as string,
          created_at: row.created_at as string,
          language: row.language as string | null,
          title: titles.get(row.id as string) ?? 'New chat',
        })));
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button type="button" aria-label="Close chat history" className="fixed inset-0 z-40 cursor-default bg-black/45" onClick={onClose} />
      <aside aria-label="Chat history" className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 text-gray-800"><Menu size={18} /><h2 className="font-bold">Chats</h2></div>
          <button type="button" onClick={onClose} aria-label="Close chat history" className="rounded-full p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <button
          type="button"
          onClick={() => { onNewChat(); onClose(); }}
          className="m-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 p-3 font-semibold text-white transition hover:bg-emerald-600"
        >
          <Plus size={18} /> نیا چیٹ
        </button>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400"><LoaderCircle size={16} className="animate-spin" /> Loading chats…</div>
          ) : error ? (
            <p className="mt-8 text-center text-sm text-gray-400">{error}</p>
          ) : conversations.length === 0 ? (
            <p className="mt-8 text-center text-sm text-gray-400">ابھی کوئی چیٹ نہیں</p>
          ) : conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              onClick={() => { onSelectConversation(conversation.id, conversation.language); onClose(); }}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg p-2.5 text-left transition ${conversation.id === currentConversationId ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <MessageSquare size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{conversation.title}</span>
              <span className="shrink-0 text-[10px] text-gray-400">{new Date(conversation.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
