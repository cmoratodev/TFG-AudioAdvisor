import type { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Medal, Award } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { RankBadge } from '@/components/ui/RankBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { tierFromKey } from '@/lib/ranks';

export const metadata: Metadata = {
  title: 'Top Advisors',
  description: 'Ranking global de productores y asesores que aportan feedback útil. De Hierro a Leyenda según tu actividad.',
};

const TOP_LIMIT = 50;

const displayName = (
  u: { name: string | null; email: string | null } | null | undefined,
): string => u?.name ?? u?.email?.split('@')[0] ?? 'Usuario';

export default async function TopAdvisorsPage() {
  const viewer = await getCurrentUser();

  const top = await prisma.user.findMany({
    orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }],
    take: TOP_LIMIT,
    select: {
      id: true,
      name: true,
      email: true,
      xp: true,
      level: true,
      _count: { select: { comments: true, tracks: true } },
    },
  });

  // If the viewer isn't in the top list, compute their global position separately.
  let viewerOutsideRank: { position: number; xp: number } | null = null;
  if (viewer?.id) {
    const inTop = top.some((u) => u.id === viewer.id);
    if (!inTop) {
      const viewerRow = await prisma.user.findUnique({
        where: { id: viewer.id },
        select: { xp: true },
      });
      if (viewerRow) {
        const higher = await prisma.user.count({ where: { xp: { gt: viewerRow.xp } } });
        viewerOutsideRank = { position: higher + 1, xp: viewerRow.xp };
      }
    }
  }

  const [first, second, third, ...rest] = top;

  return (
    <div className="container py-10 max-w-4xl mx-auto px-4 space-y-10">
      <header>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-zinc-600 text-sm font-medium mb-4">
          <Trophy size={16} />
          <span>Ranking global</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Top Advisors</h1>
        <p className="text-zinc-500 font-medium text-lg max-w-xl">
          Los productores y asesores que más feedback útil están aportando a la comunidad.
        </p>
      </header>

      {top.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
          <EmptyState
            title="Clasificación vacía"
            description="Aún no hay usuarios con actividad suficiente. Sube pistas y deja feedback para empezar a sumar XP y aparecer aquí."
            action={{ label: 'Explorar pistas', href: '/explore', variant: 'secondary' }}
          />
        </div>
      )}

      {/* Podium for top 3 */}
      {top.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[first, second, third].map((u, idx) => {
            if (!u) return <div key={`empty-${idx}`} className="hidden md:block" />;
            const position = idx + 1;
            const icon = position === 1 ? Trophy : position === 2 ? Medal : Award;
            const Icon = icon;
            const tier = tierFromKey(u.level);
            const isViewer = u.id === viewer?.id;
            // Visual order: gold center on desktop
            const desktopOrder = position === 1 ? 'md:order-2' : position === 2 ? 'md:order-1' : 'md:order-3';
            const scale = position === 1 ? 'md:scale-105' : '';
            return (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                className={`group bg-white border-2 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center ${desktopOrder} ${scale} ${
                  isViewer ? 'border-zinc-950' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon
                    size={20}
                    style={{ color: position === 1 ? '#EAB308' : position === 2 ? '#94A3B8' : '#A16207' }}
                  />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    #{position}
                  </span>
                </div>
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3 shadow"
                  style={{ backgroundColor: tier.color }}
                  aria-hidden
                >
                  {displayName(u).charAt(0).toUpperCase()}
                </div>
                <h3 className="font-bold text-lg truncate w-full group-hover:underline">{displayName(u)}</h3>
                <div className="mt-2"><RankBadge level={u.level} size="xs" /></div>
                <p className="text-2xl font-bold tabular-nums mt-3">
                  {u.xp.toLocaleString('es-ES')} <span className="text-xs font-medium text-zinc-500">XP</span>
                </p>
              </Link>
            );
          })}
        </section>
      )}

      {/* Rest of the leaderboard */}
      {rest.length > 0 && (
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="font-semibold text-sm text-zinc-950">Resto del ranking</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {rest.map((u, idx) => {
              const position = idx + 4;
              const isViewer = u.id === viewer?.id;
              return (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  className={`flex items-center justify-between px-6 py-3 transition-colors ${
                    isViewer ? 'bg-zinc-50 ring-1 ring-zinc-950/10' : 'hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-mono text-zinc-400 w-8 tabular-nums">#{position}</span>
                    <span className="font-semibold truncate">{displayName(u)}</span>
                    <RankBadge level={u.level} size="xs" />
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="hidden sm:inline text-zinc-500 font-mono text-xs">
                      {u._count.tracks} pistas · {u._count.comments} feedbacks
                    </span>
                    <span className="font-bold tabular-nums">{u.xp.toLocaleString('es-ES')} XP</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Viewer position outside top */}
      {viewerOutsideRank && (
        <section className="bg-zinc-950 text-white rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Tu posición</p>
            <p className="font-bold text-2xl tabular-nums">
              #{viewerOutsideRank.position}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Tu XP</p>
            <p className="font-bold text-2xl tabular-nums">{viewerOutsideRank.xp.toLocaleString('es-ES')}</p>
          </div>
        </section>
      )}
    </div>
  );
}
