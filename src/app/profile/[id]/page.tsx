import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Music, MessageCircle, ThumbsUp } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { RankBadge, RankProgressBar } from '@/components/ui/RankBadge';
import { TrackListItem } from '@/components/track/TrackListItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { EditableAvatar } from '@/components/profile/EditableAvatar';
import { DangerZone } from '@/components/profile/DangerZone';
import { tierFromKey } from '@/lib/ranks';
import type { TrackData } from '@/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, level: true },
  });
  if (!profile) return { title: 'Perfil no encontrado' };
  const name = profile.name ?? profile.email?.split('@')[0] ?? 'Usuario';
  return {
    title: `${name} — Perfil`,
    description: `Perfil de ${name} en Audio Advisor. Rango ${profile.level}.`,
  };
}

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const displayName = (
  u: { name: string | null; email: string | null } | null | undefined,
): string => u?.name ?? u?.email?.split('@')[0] ?? 'Usuario';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;

  const profile = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      xp: true,
      level: true,
      createdAt: true,
      tracks: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          genre: true,
          audioUrl: true,
          duration: true,
          coverUrl: true,
          _count: { select: { comments: true, versions: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { peaks: true },
          },
        },
      },
      _count: {
        select: { comments: true, tracks: true },
      },
    },
  });

  if (!profile) notFound();

  // Aggregate "Útiles" received: count votes received across all of this user's comments.
  const usefulReceived = await prisma.vote.count({
    where: { comment: { authorId: profile.id } },
  });

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;
  const name = displayName(profile);
  const tier = tierFromKey(profile.level);

  const queue: TrackData[] = profile.tracks.map((t) => ({
    id: t.id,
    title: t.title,
    author: name,
    audioUrl: t.audioUrl,
    duration: t.duration,
    genre: t.genre ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    peaks: t.versions[0]?.peaks ?? [],
  }));

  return (
    <div className="container py-10 max-w-4xl mx-auto px-4 space-y-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <EditableAvatar
          image={profile.image}
          name={name}
          fallbackColor={tier.color}
          isOwner={isSelf}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight truncate">{name}</h1>
            <RankBadge level={profile.level} size="md" />
          </div>
          <p className="text-sm text-zinc-500 font-medium">
            {isSelf ? 'Tu perfil público' : `Miembro desde ${profile.createdAt.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      </header>

      {/* XP / Rank progress */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
          Progreso de Rango
        </h2>
        <RankProgressBar xp={profile.xp} />
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Music size={18} />}
          label="Pistas subidas"
          value={profile._count.tracks}
        />
        <StatCard
          icon={<MessageCircle size={18} />}
          label="Comentarios dados"
          value={profile._count.comments}
        />
        <StatCard
          icon={<ThumbsUp size={18} />}
          label="Útiles recibidos"
          value={usefulReceived}
        />
      </section>

      {/* Tracks list */}
      <section>
        <h2 className="text-xl font-bold tracking-tight mb-4">
          Pistas {profile._count.tracks > 0 && <span className="text-zinc-400 font-mono text-base">({profile._count.tracks})</span>}
        </h2>
        {profile.tracks.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm">
            <EmptyState
              title={isSelf ? 'Aún no has subido ninguna pista' : 'Sin pistas publicadas'}
              description={
                isSelf
                  ? 'Sube tu primera pista para empezar a recibir feedback técnico.'
                  : 'Este usuario aún no ha compartido su trabajo.'
              }
              action={
                isSelf ? { label: 'Subir mi primera pista', href: '/dashboard' } : undefined
              }
            />
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm divide-y divide-zinc-100">
            {profile.tracks.map((t) => (
              <TrackListItem
                key={t.id}
                track={{
                  id: t.id,
                  title: t.title,
                  author: name,
                  audioUrl: t.audioUrl,
                  duration: t.duration,
                  genre: t.genre ?? undefined,
                  coverUrl: t.coverUrl ?? undefined,
                  peaks: t.versions[0]?.peaks ?? [],
                }}
                meta={{
                  duration: formatClock(t.duration),
                  comments: t._count.comments,
                  genre: t.genre,
                  versions: t._count.versions,
                }}
                queue={queue}
                canDelete={isSelf}
                canCreateVersion={isSelf}
              />
            ))}
          </div>
        )}
      </section>

      {/* Danger zone — GDPR account deletion. Only the owner sees it. */}
      {isSelf && <DangerZone />}
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
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
