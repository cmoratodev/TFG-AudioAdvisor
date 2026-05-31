import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageCircle, ThumbsUp, Library } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { TrackListItem } from '@/components/track/TrackListItem';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Mis Canciones',
  description: 'Gestiona tus pistas subidas, revisa feedback recibido y publica nuevas versiones.',
};

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Genres shared with the upload form ([dashboard/page.tsx]). Kept in lockstep
// manually for now; if this grows further, extract to `src/lib/genres.ts`.
const GENRES = ['Electrónica', 'Pop', 'Hip Hop', 'Acústico', 'Jazz', 'Rock', 'Otro'] as const;
const ALL_GENRE = 'Todos';
type GenreFilter = (typeof GENRES)[number] | typeof ALL_GENRE;

const SORTS = {
  newest: 'Más recientes',
  comments: 'Más comentadas',
  useful: 'Más útiles',
} as const;
type SortKey = keyof typeof SORTS;

function normalizeGenre(raw: string | string[] | undefined): GenreFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value === ALL_GENRE) return ALL_GENRE;
  return (GENRES as readonly string[]).includes(value) ? (value as GenreFilter) : ALL_GENRE;
}

function normalizeSort(raw: string | string[] | undefined): SortKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in SORTS ? (value as SortKey) : 'newest';
}

interface PageProps {
  searchParams: Promise<{ genre?: string; sort?: string }>;
}

export default async function MyTracksPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/signin?callbackUrl=/my-tracks');

  const { genre: rawGenre, sort: rawSort } = await searchParams;
  const activeGenre = normalizeGenre(rawGenre);
  const activeSort = normalizeSort(rawSort);

  // ── Summary metrics (always over the full library, never affected by the
  //    current filter — they describe the producer's career so far). ────────
  const [trackCount, commentsReceived, usefulAwarded] = await Promise.all([
    prisma.track.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { track: { authorId: user.id } } }),
    // Only the track owner can award útiles, so this counts every useful
    // mark this user has given out as the producer of their own tracks.
    prisma.vote.count({ where: { voterId: user.id } }),
  ]);

  // ── Filtered list ────────────────────────────────────────────────────────
  // Prisma supports orderBy `{ comments: { _count: 'desc' } }` directly, but
  // sorting by total useful votes across all comments needs a manual pass
  // because `Vote` is two relations deep from `Track`. We fetch with the
  // simpler orderBy and re-sort in JS when the user picks "useful".
  const tracks = await prisma.track.findMany({
    where: {
      authorId: user.id,
      ...(activeGenre === ALL_GENRE ? {} : { genre: activeGenre }),
    },
    orderBy:
      activeSort === 'comments'
        ? { comments: { _count: 'desc' } }
        : { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      genre: true,
      audioUrl: true,
      duration: true,
      coverUrl: true,
      createdAt: true,
      _count: { select: { comments: true, versions: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { peaks: true },
      },
      // For the "useful" sort + per-row tooltips: total votes across the
      // track's comments. One extra query column, paid once per row.
      comments: {
        select: { _count: { select: { votes: true } } },
      },
    },
  });

  const enriched = tracks.map((t) => ({
    ...t,
    usefulCount: t.comments.reduce((sum, c) => sum + c._count.votes, 0),
  }));

  if (activeSort === 'useful') {
    enriched.sort((a, b) => b.usefulCount - a.usefulCount);
  }

  const queue = enriched.map((t) => ({
    id: t.id,
    title: t.title,
    author: user.name ?? user.email?.split('@')[0] ?? 'Tú',
    audioUrl: t.audioUrl,
    duration: t.duration,
    genre: t.genre ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    peaks: t.versions[0]?.peaks ?? [],
  }));

  const genrePills: { key: GenreFilter; label: string }[] = [
    { key: ALL_GENRE, label: ALL_GENRE },
    ...GENRES.map((g) => ({ key: g, label: g })),
  ];

  const buildHref = (overrides: { genre?: GenreFilter; sort?: SortKey }) => {
    const params = new URLSearchParams();
    const nextGenre = overrides.genre ?? activeGenre;
    const nextSort = overrides.sort ?? activeSort;
    if (nextGenre !== ALL_GENRE) params.set('genre', nextGenre);
    if (nextSort !== 'newest') params.set('sort', nextSort);
    const qs = params.toString();
    return qs ? `/my-tracks?${qs}` : '/my-tracks';
  };

  return (
    <div className="container py-10 max-w-4xl mx-auto px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Mis Canciones</h1>
        <p className="text-zinc-500 font-medium">
          Tus pistas subidas y sesiones de feedback.
        </p>
      </div>

      {/* Summary metrics — always reflect the whole library so the filters
          don't make these numbers look like they dropped. */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Library size={18} />}
          label="Pistas publicadas"
          value={trackCount}
        />
        <StatCard
          icon={<MessageCircle size={18} />}
          label="Comentarios recibidos"
          value={commentsReceived}
        />
        <StatCard
          icon={<ThumbsUp size={18} />}
          label="Útiles otorgados"
          value={usefulAwarded}
        />
      </section>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-950">Biblioteca</h2>
          <span className="text-xs font-mono px-2 py-1 bg-zinc-200 rounded-full text-zinc-600">
            {enriched.length}
            {activeGenre === ALL_GENRE ? '' : ` de ${trackCount}`}
          </span>
        </div>

        {/* Filters — URL-driven, refresh-friendly, shareable. */}
        {trackCount > 0 && (
          <div className="px-6 py-3 border-b border-zinc-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
              {genrePills.map(({ key, label }) => {
                const isActive = key === activeGenre;
                return (
                  <Link
                    key={key}
                    href={buildHref({ genre: key })}
                    scroll={false}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                      isActive
                        ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700 hover:border-violet-700'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-950'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1">
                Ordenar
              </span>
              {(Object.keys(SORTS) as SortKey[]).map((key) => {
                const isActive = key === activeSort;
                return (
                  <Link
                    key={key}
                    href={buildHref({ sort: key })}
                    scroll={false}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    {SORTS[key]}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {trackCount === 0 ? (
          <EmptyState
            title="Tu biblioteca está vacía"
            description="Aún no has subido ninguna pista. Empieza por la primera y consigue tu primer feedback técnico."
            action={{ label: 'Subir mi primera pista', href: '/dashboard' }}
          />
        ) : enriched.length === 0 ? (
          <EmptyState
            title={`Ninguna pista en ${activeGenre}`}
            description="Cambia o quita el filtro para ver el resto de tu biblioteca."
            action={{ label: 'Quitar filtro', href: '/my-tracks', variant: 'secondary' }}
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {enriched.map((track) => (
              <TrackListItem
                key={track.id}
                track={{
                  id: track.id,
                  title: track.title,
                  author: user.name ?? user.email?.split('@')[0] ?? 'Tú',
                  audioUrl: track.audioUrl,
                  duration: track.duration,
                  genre: track.genre ?? undefined,
                  coverUrl: track.coverUrl ?? undefined,
                  peaks: track.versions[0]?.peaks ?? [],
                }}
                meta={{
                  duration: formatClock(track.duration),
                  comments: track._count.comments,
                  genre: track.genre,
                  versions: track._count.versions,
                }}
                queue={queue}
                canDelete
                canCreateVersion
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value.toLocaleString('es-ES')}</p>
    </div>
  );
}
