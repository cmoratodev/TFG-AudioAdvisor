import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-server';
import { TrackDetails } from './TrackDetails';
import type { CommentEntry, TrackData, TrackVersionSummary } from '@/types';
import type { AnalysisResult } from '@/lib/audio-analysis-types';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const track = await prisma.track.findUnique({
    where: { id },
    select: { title: true, author: { select: { name: true, email: true } } },
  });
  if (!track) return { title: 'Pista no encontrada' };
  const author = track.author.name ?? track.author.email?.split('@')[0] ?? 'Usuario';
  return {
    title: `${track.title} — ${author}`,
    description: `Escucha "${track.title}" de ${author} y deja feedback técnico anclado al segundo.`,
  };
}

const authorLabel = (
  author: { name: string | null; email: string | null } | null | undefined,
): string => {
  if (!author) return 'Usuario';
  return author.name ?? author.email?.split('@')[0] ?? 'Usuario';
};

export default async function TrackPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { v: requestedVersionParam } = await searchParams;

  const track = await prisma.track.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, level: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          audioUrl: true,
          duration: true,
          createdAt: true,
          peaks: true,
          analysis: true,
        },
      },
    },
  });

  if (!track || track.versions.length === 0) notFound();

  // Resolve which version to show. Default to latest.
  const requestedVersion = Number.parseInt(requestedVersionParam ?? '', 10);
  const selectedVersion =
    track.versions.find((v) => v.versionNumber === requestedVersion) ?? track.versions[0];

  // Fetch comments scoped to the selected version.
  const versionComments = await prisma.comment.findMany({
    where: { versionId: selectedVersion.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true, level: true } },
      votes: { select: { voterId: true } },
    },
  });

  const user = await getCurrentUser();
  const isTrackOwner = user?.id === track.author.id;

  const trackData: TrackData = {
    id: track.id,
    title: track.title,
    author: authorLabel(track.author),
    authorId: track.author.id,
    audioUrl: selectedVersion.audioUrl,
    duration: selectedVersion.duration,
    genre: track.genre ?? undefined,
    coverUrl: track.coverUrl ?? undefined,
    authorLevel: track.author.level,
    peaks: selectedVersion.peaks,
  };

  const versions: TrackVersionSummary[] = track.versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    audioUrl: v.audioUrl,
    duration: v.duration,
    createdAt: v.createdAt.getTime(),
    peaks: v.peaks,
  }));

  type RawComment = (typeof versionComments)[number];
  const toEntry = (c: RawComment): CommentEntry => ({
    id: c.id,
    content: c.content,
    timestamp: c.timestamp,
    author: authorLabel(c.author),
    authorId: c.author.id,
    authorLevel: c.author.level,
    createdAt: c.createdAt.getTime(),
    votes: c.votes.length,
    votedByViewer: user?.id ? c.votes.some((v) => v.voterId === user.id) : false,
  });

  const tops = versionComments
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((c) => {
      const replies = versionComments
        .filter((r) => r.parentId === c.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(toEntry);
      return { ...toEntry(c), replies };
    });

  const deletableIds = user?.id
    ? versionComments
        .filter((c) => c.authorId === user.id || track.author.id === user.id)
        .map((c) => c.id)
    : [];

  return (
    <div className="container py-10 max-w-5xl mx-auto px-4">
      <TrackDetails
        track={trackData}
        initialComments={tops}
        isAuthenticated={Boolean(user?.id)}
        isTrackOwner={isTrackOwner}
        deletableCommentIds={deletableIds}
        versions={versions}
        selectedVersionId={selectedVersion.id}
        selectedVersionNumber={selectedVersion.versionNumber}
        analysisResult={(selectedVersion.analysis as AnalysisResult | null) ?? null}
      />
    </div>
  );
}
