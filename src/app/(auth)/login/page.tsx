'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function BrandMark() {
  return <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 text-2xl font-black text-white shadow-lg shadow-amber-200">D</div>;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success('Welcome back!');
    router.push('/chat');
  }

  return (
    <section className="relative rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-emerald-100/70 sm:p-9">
      <Toaster position="top-center" />
      <BrandMark />
      <div className="mt-5 text-center"><h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1><p className="mt-2 text-sm text-slate-500">Log in to continue chatting with Danyal Bhai</p></div>
      <form onSubmit={handleLogin} className="mt-7 space-y-4">
        <label className="block text-sm font-medium text-slate-700">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
        <label className="block text-sm font-medium text-slate-700">Password<span className="relative mt-2 block"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        <div className="text-right"><Link href="#" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Forgot password?</Link></div>
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70">{loading && <Loader2 size={18} className="animate-spin" />}{loading ? 'Logging in...' : 'Login'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Don&apos;t have an account? <Link href="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">Sign Up</Link></p>
    </section>
  );
}
