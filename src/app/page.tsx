import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
          Danyal Bhai
        </h1>
        <p className="text-xl md:text-2xl font-medium text-emerald-600 mb-4">
          Chat with AI in Any Language
        </p>
        <p className="text-gray-500 mb-8 text-base leading-relaxed">
          Sign up and start chatting with AI
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-200 text-base"
          >
            Sign Up
          </Link>
          <Link
            href="/login"
            className="border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-semibold py-3 px-8 rounded-xl transition-colors duration-200 text-base"
          >
            Login
          </Link>
        </div>
      </div>
      <footer className="mt-8 text-white/80 text-sm">
        © 2025 Danyal Bhai
      </footer>
    </main>
  );
}
