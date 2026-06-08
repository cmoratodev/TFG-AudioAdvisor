'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User, Trophy, Menu, X } from 'lucide-react';
import { RankBadge } from '@/components/ui/RankBadge';
import { NotificationBell } from '@/components/layout/NotificationBell';

/**
 * Barra de navegación principal.
 *
 * En `md` y superior muestra los enlaces inline. Por debajo de `md` los
 * colapsa en un menú hamburguesa para que el logo, la campana y el chip de
 * perfil sigan visibles sin saturar la barra en pantallas estrechas.
 *
 * `NotificationBell` se renderiza una sola vez en el cluster compartido a
 * la derecha — montarlo dos veces (uno en cada bloque responsive) abriría
 * dos suscripciones al mismo canal de Supabase Realtime y rompería el hook.
 */

type NavLink = {
  href: string;
  label: string;
  icon?: typeof Trophy;
};

const NAV_LINKS: readonly NavLink[] = [
  { href: '/explore', label: 'Explorar' },
  { href: '/dashboard', label: 'Subir Pista' },
  { href: '/my-tracks', label: 'Mis Canciones' },
  { href: '/top-advisors', label: 'Top Advisors', icon: Trophy },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const isAuth = status === 'authenticated';
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el menú móvil al cambiar de ruta.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Cierre por click fuera + tecla Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMobileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="font-bold text-xl tracking-tight">
          Audio Advisor.
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="text-zinc-600 hover:text-zinc-950 transition-colors inline-flex items-center gap-1.5"
            >
              {Icon && <Icon size={14} />}
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 relative" ref={menuRef}>
          {status === 'loading' ? (
            <div className="w-32 h-7 bg-zinc-100 rounded animate-pulse" />
          ) : isAuth && session?.user?.id ? (
            <>
              <span className="hidden md:inline-block h-5 w-px bg-zinc-200" aria-hidden />
              <NotificationBell viewerId={session.user.id} />

              <Link
                href={`/profile/${session.user.id}`}
                className="hidden md:flex items-center gap-2 hover:bg-zinc-100 px-2 py-1 -mx-2 -my-1 rounded-lg transition-colors"
                title="Ver mi perfil"
              >
                {session.user.level && <RankBadge level={session.user.level} size="xs" />}
                <span className="flex items-center gap-2 text-zinc-700">
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
                className="hidden md:inline-flex text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                <LogOut size={18} />
              </button>

              {session.user.level && (
                <span className="md:hidden">
                  <RankBadge level={session.user.level} size="xs" showName={false} />
                </span>
              )}
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={mobileOpen}
                className="md:hidden text-zinc-600 hover:text-zinc-950 transition-colors p-1.5 -m-1.5"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/signin"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors text-sm font-medium"
                >
                  Entrar
                </Link>
                <Link
                  href="/signup"
                  className="bg-zinc-950 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-zinc-800 transition-colors"
                >
                  Crear cuenta
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={mobileOpen}
                className="md:hidden text-zinc-600 hover:text-zinc-950 transition-colors p-1.5 -m-1.5"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          )}

          {mobileOpen && (
            <div
              role="dialog"
              aria-label="Menú principal"
              className="md:hidden absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2"
            >
              <nav className="py-2">
                {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                  >
                    {Icon && <Icon size={16} className="text-zinc-400" />}
                    {label}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-zinc-100 py-2">
                {status === 'loading' ? (
                  <div className="px-4 py-2">
                    <div className="w-24 h-4 bg-zinc-100 rounded animate-pulse" />
                  </div>
                ) : isAuth && session?.user?.id ? (
                  <>
                    <Link
                      href={`/profile/${session.user.id}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                    >
                      <User size={16} className="text-zinc-400" />
                      <span className="font-semibold truncate">
                        {session.user.name ?? session.user.email?.split('@')[0]}
                      </span>
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                    >
                      <LogOut size={16} className="text-zinc-400" />
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signin"
                      className="flex items-center px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 transition-colors"
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/signup"
                      className="flex items-center px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 transition-colors"
                    >
                      Crear cuenta
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
