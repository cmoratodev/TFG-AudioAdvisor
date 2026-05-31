import Link from 'next/link'
import { Home, Compass } from 'lucide-react'

/**
 * Custom 404 page. Triggered automatically by Next when:
 *   - A route doesn't match anything in the App Router
 *   - A Server Component calls `notFound()` (e.g. unknown track id)
 *
 * Visual language mirrors the auth split panels and footer (dark surface +
 * violet accent) so a missing page still feels like part of the product.
 */
export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-16">
      <div
        className="w-full max-w-lg rounded-2xl text-white text-center px-10 py-14 relative overflow-hidden"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124, 58, 237, 0.25), transparent 70%)',
            'linear-gradient(to bottom, #18181b 0%, #09090b 100%)',
          ].join(', '),
        }}
      >
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-300 mb-3">
          Error 404
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Esta pista no existe.
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-8 max-w-sm mx-auto">
          La página que buscas no está aquí. Puede que el enlace esté roto, la pista haya sido
          eliminada o nunca haya existido.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 px-5 py-2.5 rounded-full font-semibold hover:bg-zinc-200 transition-colors"
          >
            <Home size={16} />
            Ir al inicio
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-white/10 transition-colors"
          >
            <Compass size={16} />
            Explorar pistas
          </Link>
        </div>
      </div>
    </div>
  )
}
