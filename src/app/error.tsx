'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, Home, RefreshCw } from 'lucide-react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary for the App Router. Triggered when an uncaught error
 * bubbles up from a Server Component, a Server Action, or a streaming
 * render. Sits below the root layout, so the Navbar / Footer still render
 * around it — the user always has a way to navigate away.
 *
 * `error.digest` is a server-assigned hash useful for finding the matching
 * stack trace in production logs; we surface it discreetly so a savvy user
 * (or the support inbox) can copy it.
 */
export default function GlobalError({ error, reset }: Props) {
  // Log to the browser console too — devs poking around in DevTools see
  // the same stack trace they'd see in the server logs.
  useEffect(() => {
    console.error('[app-error]', error)
  }, [error])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-16">
      <div
        className="w-full max-w-lg rounded-2xl text-white text-center px-10 py-14 relative overflow-hidden"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(220, 38, 38, 0.18), transparent 70%)',
            'linear-gradient(to bottom, #18181b 0%, #09090b 100%)',
          ].join(', '),
        }}
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mb-6">
          <AlertOctagon size={26} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Algo se ha roto.</h1>
        <p className="text-zinc-400 leading-relaxed mb-2 max-w-sm mx-auto">
          Ha ocurrido un error inesperado mientras procesábamos tu solicitud. Puedes intentarlo de
          nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-zinc-600 mt-2 mb-8">
            Referencia: <span className="text-zinc-500">{error.digest}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 px-5 py-2.5 rounded-full font-semibold hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw size={16} />
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-white/10 transition-colors"
          >
            <Home size={16} />
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
