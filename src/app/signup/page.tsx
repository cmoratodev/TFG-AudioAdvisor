'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || undefined, email: email.trim(), password }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'Error creando la cuenta.');
      setLoading(false);
      return;
    }

    // Auto sign-in right after registration.
    const signInRes = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (!signInRes || signInRes.error) {
      setError('Cuenta creada, pero hubo un problema iniciando sesión. Inténtalo manualmente.');
      router.push('/signin');
      return;
    }
    router.push('/my-tracks');
    router.refresh();
  };

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Empieza a recibir feedback en tus pistas."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/signin" className="font-semibold text-zinc-950 hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form
        onSubmit={onSubmit}
        className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4"
      >
        <div>
          <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
            Nombre <span className="text-zinc-400 normal-case font-normal tracking-normal">(opcional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
          />
        </div>
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
            Contraseña <span className="text-zinc-400 normal-case font-normal tracking-normal">(mín. 8 caracteres)</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  );
}
