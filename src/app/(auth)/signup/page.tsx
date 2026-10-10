'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function BrandMark() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 text-2xl font-black text-white shadow-lg shadow-amber-200">
      D
    </div>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/chat` },
    });

    if (signupError) {
      setError(signupError.message);
    } else if (data.session) {
      window.location.assign('/chat');
      return;
    } else {
      setMessage('Check your email to confirm your account, then come back to chat.');
    }
    setLoading(false);
  }

  return (
    <section className="rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-emerald-100/70 sm:p-9">
      <BrandMark />
      <div className="mt-5 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Your Account</h1>
        <p className="mt-2 text-sm text-slate-500">Join Danyal Bhai and start chatting</p>
      </div>

      {error && <div role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <form onSubmit={handleSignup} className="mt-7 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <span className="relative mt-2 block">
            <input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Confirm Password
          <span className="relative mt-2 block">
            <input required type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            <button type="button" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70">
          {loading && <Loader2 size={18} className="animate-spin" />} {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" /><span>or</span><div className="h-px flex-1 bg-slate-200" /></div>
      <p className="text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">Login</Link></p>
    </section>
  );
}
