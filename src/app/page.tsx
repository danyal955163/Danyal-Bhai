import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import HomeRedirect from '@/components/HomeRedirect';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/chat');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-4">
      <HomeRedirect />
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl md:p-12">
        <div className="mx-auto flex justify-center"><AnimatedLogo size="lg" /></div>
        <p className="mb-4 mt-4 text-xl font-medium text-emerald-600 md:text-2xl">Your multilingual voice assistant</p>
        <p className="mb-8 text-base leading-relaxed text-gray-500">Sign up and start chatting with AI</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row"><Link href="/signup" className="rounded-xl bg-emerald-500 px-8 py-3 font-semibold text-white transition-colors hover:bg-emerald-600">Sign Up</Link><Link href="/login" className="rounded-xl border-2 border-emerald-500 px-8 py-3 font-semibold text-emerald-600 transition-colors hover:bg-emerald-50">Login</Link></div>
      </div>
      <footer className="mt-8 text-sm text-white/80">© 2025 Danyal Bhai</footer>
    </main>
  );
}
