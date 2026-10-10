'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) router.replace('/login');
      else setUser(data.user);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-50">
      <header className="flex items-center justify-between bg-white p-4 shadow-sm"><h1 className="text-xl font-bold text-slate-900">Danyal Bhai</h1><button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-500 transition hover:text-red-700"><LogOut size={16} /> Sign Out</button></header>
      <main className="p-8 text-center"><p className="text-slate-600">Chat will be added in Step 4</p><p className="mt-4 text-sm text-slate-400">Logged in as: {user?.email}</p></main>
    </div>
  );
}
