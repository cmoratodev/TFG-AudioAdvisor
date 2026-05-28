import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Music } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { TrackListItem } from '@/components/track/TrackListItem';

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default async function MyTracksPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/signin?callbackUrl=/my-tracks');

  const tracks = await prisma.track.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      genre: true,
      audioUrl: true,
      duration: true,
      createdAt: true,
      _count: { select: { comments: true, versions: true } },
    },
  });

  const queue = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    author: user.name ?? user.email?.split('@')[0] ?? 'Tú',
    audioUrl: t.audioUrl,
    duration: t.duration,
  }));

  return (
    <div className="container py-10 max-w-3xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Mis Canciones</h1>
        <p className="text-zinc-500 font-medium">Tus pistas subidas y sesiones de feedback.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-zinc-950">Biblioteca</h2>
          <span className="text-xs font-mono px-2 py-1 bg-zinc-200 rounded-full text-zinc-600">
            {tracks.length}
          </span>
        </div>

        {tracks.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <Music size={32} className="mb-4 opacity-20" />
            <p className="mb-6">Aún no has subido ninguna pista.</p>
            <Link
              href="/dashboard"
              className="bg-zinc-950 text-white px-6 py-2 rounded-full font-medium hover:bg-zinc-800 transition-colors"
            >
              Subir Pista
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {tracks.map((track) => (
              <TrackListItem
                key={track.id}
                track={{
                  id: track.id,
                  title: track.title,
                  author: user.name ?? user.email?.split('@')[0] ?? 'Tú',
                  audioUrl: track.audioUrl,
                  duration: track.duration,
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
