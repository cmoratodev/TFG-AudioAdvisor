'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User, Trophy } from 'lucide-react';
import { RankBadge } from '@/components/ui/RankBadge';
import { NotificationBell } from '@/components/layout/NotificationBell';

export function Navbar() {
  const { data: session, status } = useSession();
  const isAuth = status === 'authenticated';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-bold text-xl tracking-tight">
          Audio Advisor.
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/explore" className="text-zinc-600 hover:text-zinc-950 transition-colors">
            Explorar
          </Link>
          <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-950 transition-colors">
            Subir Pista
          </Link>
          <Link href="/my-tracks" className="text-zinc-600 hover:text-zinc-950 transition-colors">
            Mis Canciones
          </Link>
          <Link
            href="/top-advisors"
            className="text-zinc-600 hover:text-zinc-950 transition-colors hidden md:inline-flex items-center gap-1.5"
          >
            <Trophy size={14} />
            Top Advisors
          </Link>

          <span className="h-5 w-px bg-zinc-200" aria-hidden />

          {status === 'loading' ? (
            <div className="w-32 h-7 bg-zinc-100 rounded animate-pulse" />
          ) : isAuth && session?.user?.id ? (
            <div className="flex items-center gap-3">
              <NotificationBell viewerId={session.user.id} />
              <Link
                href={`/profile/${session.user.id}`}
                className="flex items-center gap-2 hover:bg-zinc-100 px-2 py-1 -mx-2 -my-1 rounded-lg transition-colors"
                title="Ver mi perfil"
              >
                {session.user.level && <RankBadge level={session.user.level} size="xs" />}
                <span className="hidden sm:flex items-center gap-2 text-zinc-700">
                  <User size={16} className="text-zinc-500" />
                  <span className="font-semibold">
                    {session.user.name ?? session.user.email?.split('@')[0]}
                  </span>
                </span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/signin" className="text-zinc-600 hover:text-zinc-950 transition-colors">
                Entrar
              </Link>
              <Link
                href="/signup"
                className="bg-zinc-950 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-zinc-800 transition-colors"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
