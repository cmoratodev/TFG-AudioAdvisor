'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

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

      <p className="text-center text-xs text-zinc-500 pt-1">
        <Link href="/forgot-password" className="hover:text-zinc-950 hover:underline transition-colors">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Vuelve a tus pistas y a tu feedback."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="font-semibold text-zinc-950 hover:underline">
            Crea una
          </Link>
        </>
      }
    >
      <Suspense
        fallback={<div className="h-72 bg-white border border-zinc-200 rounded-xl shadow-sm animate-pulse" />}
      >
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
