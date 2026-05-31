import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, Search } from 'lucide-react'

import { prisma } from '@/lib/prisma'
import { ExploreCard } from './ExploreCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { TrackData } from '@/types'

export const metadata: Metadata = {
  title: 'Explorar',
  description: 'Descubre nuevas pistas, escucha trabajo en proceso y deja feedback técnico para ayudar a otros productores.',
}

/**
 * Public discovery page. The list of genres mirrors the upload form
 * ([dashboard/page.tsx]), plus a synthetic "Todos" pseudo-genre. We list it
 * here statically — it never changes between sessions — and treat
 * `?genre=...` as the active filter. Anything not on this list is rejected
 * so a malformed URL doesn't run an arbitrary `where` query.
 *
 * Text search via `?q=...` matches against `Track.title` or the author's
 * `User.name` (case-insensitive `contains`). Native HTML form submission
 * keeps the page SSR-friendly — no client state needed.
 */
const GENRES = ['Electrónica', 'Pop', 'Hip Hop', 'Acústico', 'Jazz', 'Rock', 'Otro'] as const
const ALL_GENRE = 'Todos'

type GenreFilter = (typeof GENRES)[number] | typeof ALL_GENRE

function normalizeGenre(raw: string | string[] | undefined): GenreFilter {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || value === ALL_GENRE) return ALL_GENRE
  return (GENRES as readonly string[]).includes(value) ? (value as GenreFilter) : ALL_GENRE
}

const displayName = (
  u: { name: string | null; email: string | null } | null | undefined,
): string => u?.name ?? u?.email?.split('@')[0] ?? 'Usuario'

interface PageProps {
  searchParams: Promise<{ genre?: string; q?: string }>
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const { genre: rawGenre, q: rawQ } = await searchParams
  const activeGenre = normalizeGenre(rawGenre)
  const q = typeof rawQ === 'string' ? rawQ.trim() : ''

  const tracks = await prisma.track.findMany({
    where: {
      ...(activeGenre === ALL_GENRE ? {} : { genre: activeGenre }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { author: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      genre: true,
      audioUrl: true,
      duration: true,
      coverUrl: true,
      author: { select: { id: true, name: true, email: true, level: true } },
      _count: { select: { comments: true } },
      // Peaks for the latest version drive the mini wave in the global
      // AudioPlayer. ~15 KB per row gzipped — acceptable for a 50-row feed.
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { peaks: true },
      },
    },
  })

  const cards = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    audioUrl: t.audioUrl,
    duration: t.duration,
    author: displayName(t.author),
    authorId: t.author.id,
    authorLevel: t.author.level,
    genre: t.genre ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    commentCount: t._count.comments,
    peaks: t.versions[0]?.peaks ?? [],
  }))

  // Same array shape as TrackData — used as the playback queue when the user
  // hits play on any card in this view.
  const queue: TrackData[] = cards.map(
    ({ id, title, audioUrl, duration, author, authorId, genre, coverUrl, peaks }) => ({
      id,
      title,
      audioUrl,
      duration,
      author,
      authorId,
      genre,
      coverUrl,
      peaks,
    }),
  )

  const genrePills: { key: GenreFilter; label: string }[] = [
    { key: ALL_GENRE, label: ALL_GENRE },
    ...GENRES.map((g) => ({ key: g, label: g })),
  ]

  // Helper to build `?genre=...&q=...` while preserving the other dimension.
  const buildHref = (overrides: { genre?: GenreFilter; q?: string }) => {
    const params = new URLSearchParams()
    const nextGenre = overrides.genre ?? activeGenre
    const nextQ = overrides.q ?? q
    if (nextGenre !== ALL_GENRE) params.set('genre', nextGenre)
    if (nextQ) params.set('q', nextQ)
    const qs = params.toString()
    return qs ? `/explore?${qs}` : '/explore'
  }

  return (
    <div className="container py-10 max-w-5xl mx-auto px-4">
      <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-zinc-600 text-sm font-medium mb-4">
            <Compass size={16} />
            <span>Descubrimiento</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Explorar Pistas</h1>
          <p className="text-zinc-500 font-medium text-lg max-w-xl">
            Descubre nuevos talentos, escucha canciones en proceso y ofrece tu feedback técnico
            para ayudarles a subir de nivel.
          </p>
        </div>
      </div>

      {/* Search — native HTML form so the page stays SSR. The hidden input
          preserves the active genre filter across queries. */}
      <form action="/explore" method="GET" className="mb-4">
        <label htmlFor="q" className="sr-only">
          Buscar pistas o productores
        </label>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
            aria-hidden
          />
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por título o productor…"
            className="w-full h-11 pl-10 pr-4 rounded-full border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
          />
          {activeGenre !== ALL_GENRE && (
            <input type="hidden" name="genre" value={activeGenre} />
          )}
        </div>
      </form>

      {/* Genre filter — `<Link>` navigation keeps state in the URL so refresh /
          share preserves the view and the page can stay SSR. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8">
        {genrePills.map(({ key, label }) => {
          const isActive = key === activeGenre
          return (
            <Link
              key={key}
              href={buildHref({ genre: key })}
              scroll={false}
              className={`px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors border ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700 hover:border-violet-700'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-950'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Active search chip — lets the user clear their text query without
          touching the genre filter. */}
      {q && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Resultados para</span>
          <span className="inline-flex items-center gap-2 bg-zinc-950 text-white px-3 py-1 rounded-full text-xs font-semibold">
            &quot;{q}&quot;
            <Link
              href={buildHref({ q: '' })}
              aria-label="Quitar búsqueda"
              className="hover:text-zinc-300 transition-colors"
            >
              ✕
            </Link>
          </span>
        </div>
      )}

      {cards.length === 0 ? (
        q ? (
          <EmptyState
            title="Sin resultados"
            description={`No hay pistas que coincidan con "${q}". Prueba con otra búsqueda o explora por género.`}
            action={{ label: 'Ver todas las pistas', href: buildHref({ q: '' }), variant: 'secondary' }}
          />
        ) : activeGenre === ALL_GENRE ? (
          <EmptyState
            title="Aún no hay pistas publicadas"
            description="Sé la primera persona en compartir tu trabajo y empieza a recibir feedback técnico."
            action={{ label: 'Subir mi primera pista', href: '/dashboard' }}
          />
        ) : (
          <EmptyState
            title={`Sin pistas en ${activeGenre}`}
            description="Prueba otro género o vuelve más tarde."
            action={{ label: 'Ver todas las pistas', href: '/explore', variant: 'secondary' }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <ExploreCard key={card.id} track={card} queue={queue} />
          ))}
        </div>
      )}
    </div>
  )
}
