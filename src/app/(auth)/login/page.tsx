'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import { loadPreferences } from '@/lib/preferences';
import { getAuthErrorMessage, getAuthMessage } from '@/lib/authErrorMessages';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uiLanguage, setUiLanguage] = useState('en-US');

  useEffect(() => setUiLanguage(loadPreferences().uiLanguage), []);
  const copy = uiLanguage === 'ur-PK'
    ? { title: 'می AI میں خوش آمدید', subtitle: 'آواز یا تحریری چیٹ جاری رکھنے کے لیے سائن اِن کریں۔', email: 'ای میل', password: 'پاس ورڈ', passwordHint: 'اپنا پاس ورڈ درج کریں', forgot: 'پاس ورڈ بھول گئے؟', loading: 'لاگ اِن ہو رہا ہے…', login: 'لاگ اِن', account: 'اکاؤنٹ نہیں ہے؟', signup: 'سائن اپ', show: 'پاس ورڈ دکھائیں', hide: 'پاس ورڈ چھپائیں', success: 'واپس خوش آمدید!' }
    : uiLanguage === 'ps-AF'
      ? { title: 'Me AI ته ښه راغلاست', subtitle: 'د غږیزو یا لیکلو خبرو د دوام لپاره ننوځئ.', email: 'برېښنالیک', password: 'پټنوم', passwordHint: 'خپل پټنوم ولیکئ', forgot: 'پټنوم مو هېر شوی؟', loading: 'ننوتل کېږي…', login: 'ننوتل', account: 'حساب نه لرئ؟', signup: 'حساب جوړ کړئ', show: 'پټنوم ښکاره کړئ', hide: 'پټنوم پټ کړئ', success: 'بیا ښه راغلاست!' }
      : { title: 'Welcome Back to Me AI', subtitle: 'Sign in to continue with voice or text chat.', email: 'Email', password: 'Password', passwordHint: 'Your password', forgot: 'Forgot password?', loading: 'Logging in...', login: 'Login', account: "Don't have an account?", signup: 'Sign Up', show: 'Show password', hide: 'Hide password', success: 'Welcome back!' };

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error(getAuthMessage('emailRequired', uiLanguage));
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.error(getAuthMessage('emailInvalid', uiLanguage));
      return;
    }
    if (!password) {
      toast.error(getAuthMessage('passwordRequired', uiLanguage));
      return;
    }

    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        toast.error(getAuthErrorMessage(error, uiLanguage, 'login'));
        return;
      }
      toast.success(copy.success);
      router.push('/chat');
    } catch (error) {
      toast.error(getAuthErrorMessage(error, uiLanguage, 'login'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section lang={uiLanguage} dir={uiLanguage === 'ur-PK' || uiLanguage === 'ps-AF' ? 'rtl' : 'ltr'} className="relative rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-emerald-100/70 sm:p-9">
      <Toaster position="top-center" />
      <div className="mx-auto flex justify-center"><AnimatedLogo size="md" /></div>
      <div className="mt-5 text-center"><h1 className="text-3xl font-bold tracking-tight text-slate-900">{copy.title}</h1><p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p></div>
      <form onSubmit={handleLogin} noValidate className="mt-7 space-y-4">
        <label className="block text-sm font-medium text-slate-700">{copy.email}<input required type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>
        <label className="block text-sm font-medium text-slate-700">{copy.password}<span className="relative mt-2 block"><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordHint} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /><button type="button" aria-label={showPassword ? copy.hide : copy.show} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        <div className="text-right"><Link href="#" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">{copy.forgot}</Link></div>
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70">{loading && <Loader2 size={18} className="animate-spin" />}{loading ? copy.loading : copy.login}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">{copy.account} <Link href="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">{copy.signup}</Link></p>
    </section>
  );
}
