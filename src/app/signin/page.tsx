'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/my-tracks';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      setError('Email o contraseña incorrectos.');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4"
    >
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
        />
      </div>

      {error && (
        <div role="alert" className="text-xs text-red-600 font-medium px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-lg bg-zinc-950 text-white font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}

export default function SignInPage() {
  return (
    <div className="container max-w-md mx-auto py-16 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Iniciar sesión</h1>
        <p className="text-zinc-500 font-medium">Vuelve a tus pistas y feedback.</p>
      </div>

      <Suspense
        fallback={<div className="h-72 bg-white border border-zinc-200 rounded-xl shadow-sm animate-pulse" />}
      >
        <SignInForm />
      </Suspense>

      <p className="text-center text-sm text-zinc-600 mt-6">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="font-semibold text-zinc-950 hover:underline">
          Crea una
        </Link>
      </p>
    </div>
  );
}
