import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { NewVersionForm } from './NewVersionForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const track = await prisma.track.findUnique({
    where: { id },
    select: { title: true },
  });
  return {
    title: track ? `Nueva versión — ${track.title}` : 'Nueva versión',
    description: 'Sube una nueva versión de tu pista. Los comentarios de versiones anteriores se preservan.',
  };
}

export default async function NewVersionPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user?.id) redirect(`/signin?callbackUrl=/track/${id}/version`);

  const track = await prisma.track.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      authorId: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true, createdAt: true },
      },
    },
  });

  if (!track) notFound();
  if (track.authorId !== user.id) {
    return (
      <div className="container max-w-2xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">No tienes permiso</h1>
        <p className="text-zinc-500">Solo el autor de la pista puede subir nuevas versiones.</p>
      </div>
    );
  }

  const latest = track.versions[0];

  return (
    <div className="container max-w-2xl mx-auto py-10 px-4">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href={`/track/${track.id}`}
          aria-label="Volver a la pista"
          className="w-10 h-10 rounded-full flex items-center justify-center border border-zinc-200 text-zinc-600 hover:bg-zinc-950 hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Nueva versión</h1>
          <p className="text-zinc-500 font-medium truncate">
            {track.title} · V{(latest?.versionNumber ?? 0) + 1}
          </p>
        </div>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 mb-6 text-sm text-zinc-600">
        Sube una revisión nueva de esta pista (re-mezcla, master, edits). Los comentarios de versiones
        anteriores permanecerán visibles en sus respectivas versiones, pero la nueva empezará con la
        lista de comentarios vacía para que recibas feedback fresco.
      </div>

      <NewVersionForm trackId={track.id} />
    </div>
  );
}
