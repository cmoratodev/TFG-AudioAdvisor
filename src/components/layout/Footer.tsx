'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Global footer rendered after `<main>` and before the (fixed) AudioPlayer.
 *
 * Dark surface — part of a small family of intentionally dark zones across
 * the app (auth split panel, this footer, eventually a Home accent block)
 * so the brand reads consistently instead of "one weird dark page". The
 * faint violet glow at the top-left echoes the auth panel.
 *
 * Hidden on the auth routes because they already concentrate a lot of dark
 * weight (the AuthShell's right-hand panel), so a second dark band right
 * below it overpowers the form. Standard pattern — Vercel, Linear, Stripe
 * all drop their footers from the sign-in flow.
 *
 * Rounded top corners + `pb-24` overlap guard for the floating AudioPlayer.
 */
const HIDDEN_ROUTES = ['/signin', '/signup']

export function Footer() {
  const pathname = usePathname()
  if (pathname && HIDDEN_ROUTES.includes(pathname)) return null

  return (
    <footer
      className="relative text-zinc-300 pb-24 overflow-hidden rounded-t-[3rem]"
      style={{
        backgroundImage: [
          'radial-gradient(ellipse 50% 80% at 15% 0%, rgba(124, 58, 237, 0.12), transparent 70%)',
          'linear-gradient(to bottom, #18181b 0%, #09090b 100%)',
        ].join(', '),
      }}
    >
      <div className="container mx-auto max-w-6xl px-4 sm:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="font-bold text-xl tracking-tight inline-block text-white"
            >
              Audio Advisor.
            </Link>
            <p className="mt-3 text-sm text-zinc-400 max-w-xs leading-relaxed">
              Feedback técnico de audio anclado al segundo, sin concesiones. Sube tu pista y
              recibe comentarios reales.
            </p>
          </div>

          {/* Nav columns */}
          <nav className="grid grid-cols-2 gap-6">
            <FooterColumn title="Producto">
              <FooterLink href="/explore">Explorar</FooterLink>
              <FooterLink href="/dashboard">Subir pista</FooterLink>
              <FooterLink href="/my-tracks">Mis canciones</FooterLink>
            </FooterColumn>
            <FooterColumn title="Comunidad">
              <FooterLink href="/top-advisors">Top Advisors</FooterLink>
              <FooterLink href="/signin">Iniciar sesión</FooterLink>
              <FooterLink href="/signup">Crear cuenta</FooterLink>
            </FooterColumn>
          </nav>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p>TFG · Carlos Morato · 2026</p>
          <p>Hecho con Next.js, Prisma y Supabase.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3">
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-zinc-400 hover:text-white hover:underline transition-colors"
      >
        {children}
      </Link>
    </li>
  )
}
