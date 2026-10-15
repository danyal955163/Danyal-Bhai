'use client';

import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AnimatedLogo from '@/components/Brand/AnimatedLogo';
import { loadPreferences } from '@/lib/preferences';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uiLanguage, setUiLanguage] = useState('en-US');

  useEffect(() => setUiLanguage(loadPreferences().uiLanguage), []);
  const copy = uiLanguage === 'ur-PK'
    ? { title: 'اپنا Me AI اکاؤنٹ بنائیں', subtitle: 'شامل ہوں اور آواز یا تحریر سے گفتگو شروع کریں۔', email: 'ای میل', password: 'پاس ورڈ', passwordHint: 'کم از کم 6 حروف', confirm: 'پاس ورڈ کی تصدیق', repeat: 'پاس ورڈ دوبارہ لکھیں', loading: 'اکاؤنٹ بن رہا ہے…', signup: 'سائن اپ', existing: 'پہلے سے اکاؤنٹ ہے؟', login: 'لاگ اِن', show: 'پاس ورڈ دکھائیں', hide: 'پاس ورڈ چھپائیں', tooShort: 'پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔', mismatch: 'پاس ورڈ ایک جیسے نہیں ہیں۔', success: 'اکاؤنٹ بن گیا!' }
    : uiLanguage === 'ps-AF'
      ? { title: 'خپل Me AI حساب جوړ کړئ', subtitle: 'یوځای شئ او په غږ یا لیکلو خبرې پیل کړئ.', email: 'برېښنالیک', password: 'پټنوم', passwordHint: 'لږ تر لږه ۶ توري', confirm: 'پټنوم تایید کړئ', repeat: 'پټنوم بیا ولیکئ', loading: 'حساب جوړېږي…', signup: 'حساب جوړ کړئ', existing: 'مخکې حساب لرئ؟', login: 'ننوتل', show: 'پټنوم ښکاره کړئ', hide: 'پټنوم پټ کړئ', tooShort: 'پټنوم باید لږ تر لږه ۶ توري ولري.', mismatch: 'پټنومونه سره برابر نه دي.', success: 'حساب جوړ شو!' }
      : { title: 'Create Your Me AI Account', subtitle: 'Join and start chatting by voice or text.', email: 'Email', password: 'Password', passwordHint: 'At least 6 characters', confirm: 'Confirm Password', repeat: 'Repeat your password', loading: 'Creating account...', signup: 'Sign Up', existing: 'Already have an account?', login: 'Login', show: 'Show password', hide: 'Hide password', tooShort: 'Password must be at least 6 characters.', mismatch: 'Passwords do not match.', success: 'Account created!' };

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error(copy.tooShort);
      return;
    }
    if (password !== confirmPassword) {
      toast.error(copy.mismatch);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success(copy.success);
    router.push('/chat');
  }

  return (
    <section lang={uiLanguage} dir={uiLanguage === 'ur-PK' || uiLanguage === 'ps-AF' ? 'rtl' : 'ltr'} className="relative rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-emerald-100/70 sm:p-9">
      <Toaster position="top-center" />
      <div className="mx-auto flex justify-center"><AnimatedLogo size="md" /></div>
      <div className="mt-5 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{copy.subtitle}</p>
      </div>
      <form onSubmit={handleSignup} className="mt-7 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          {copy.email}
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {copy.password}
          <span className="relative mt-2 block">
            <input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.passwordHint} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            <button type="button" aria-label={showPassword ? copy.hide : copy.show} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {copy.confirm}
          <span className="relative mt-2 block">
            <input required type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.repeat} className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            <button type="button" aria-label={showConfirmPassword ? copy.hide : copy.show} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
        </label>
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70">
          {loading && <Loader2 size={18} className="animate-spin" />}{loading ? copy.loading : copy.signup}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">{copy.existing} <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">{copy.login}</Link></p>
    </section>
  );
}
