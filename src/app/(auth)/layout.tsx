export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_#d1fae5,_transparent_48%),radial-gradient(ellipse_at_bottom_right,_#cffafe,_transparent_46%),linear-gradient(135deg,_#f8fafc,_#ecfdf5_52%,_#f0fdfa)] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {children}
        <p className="mt-6 text-center text-xs font-medium tracking-wide text-slate-500">Me AI <span aria-hidden="true">·</span> Voice and text assistant</p>
      </div>
    </main>
  );
}
