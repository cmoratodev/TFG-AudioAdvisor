'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Music, Play, Activity, Trash2, MessageCircle, GitBranch, Plus } from 'lucide-react';
import type { TrackData } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';

interface Meta {
  duration: string;
  comments: number;
  genre: string | null;
  /** Latest version number; omit or 1 to hide the badge. */
  versions?: number;
}

interface Props {
  track: TrackData;
  meta: Meta;
  queue: TrackData[];
  /** Show the destructive delete button. Only the track owner should see it. */
  canDelete?: boolean;
  /** Show the "new version" shortcut. Only the track owner. */
  canCreateVersion?: boolean;
}

export function TrackListItem({
  track,
  meta,
  queue,
  canDelete = false,
  canCreateVersion = false,
}: Props) {
  const router = useRouter();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const clear = usePlayerStore((s) => s.clear);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCurrent = currentTrack?.id === track.id;

  const onPlay = () => playTrack(track, queue);

  const onDelete = async () => {
    if (!canDelete) return;
    if (!confirm(`¿Eliminar "${track.title}"? Esta acción es definitiva.`)) return;
    setIsDeleting(true);
    const res = await fetch(`/api/tracks/${track.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('No se pudo eliminar la pista.');
      setIsDeleting(false);
      return;
    }
    if (isCurrent) clear();
    router.refresh();
  };

  return (
    <div className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between group">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-12 h-12 rounded flex items-center justify-center shrink-0 ${
            isCurrent ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-400'
          }`}
        >
          <Music size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/track/${track.id}`}
              className="font-semibold text-zinc-950 hover:underline truncate block"
            >
              {track.title}
            </Link>
            {meta.versions && meta.versions > 1 && (
              <span
                title={`${meta.versions} versiones`}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-full px-1.5 py-0.5 shrink-0"
              >
                <GitBranch size={10} aria-hidden />
                V{meta.versions}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span>{meta.duration}</span>
            {meta.genre && (
              <>
                <span aria-hidden>·</span>
                <span>{meta.genre}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} aria-hidden /> {meta.comments}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canCreateVersion && (
          <Link
            href={`/track/${track.id}/version`}
            aria-label="Subir nueva versión"
            title="Subir nueva versión"
            className="w-10 h-10 rounded-full bg-white border border-zinc-200 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white flex items-center justify-center text-zinc-950 shadow-sm transition-all"
          >
            <Plus size={18} />
          </Link>
        )}

        <Link
          href={`/track/${track.id}`}
          aria-label="Abrir onda y feedback"
          title="Abrir Onda y Feedback"
          className="w-10 h-10 rounded-full bg-white border border-zinc-200 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white flex items-center justify-center text-zinc-950 shadow-sm transition-all"
        >
          <Activity size={18} />
        </Link>

        <button
          onClick={onPlay}
          aria-label="Reproducir de fondo"
          title="Reproducir de Fondo"
          className="w-10 h-10 rounded-full bg-white border border-zinc-200 text-zinc-950 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm transition-all"
        >
          <Play size={18} className="translate-x-[1px]" />
        </button>

        {canDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Eliminar pista"
            title="Eliminar pista"
            className="w-10 h-10 rounded-full bg-white border border-zinc-200 text-zinc-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600 active:scale-95 flex items-center justify-center shadow-sm transition-all disabled:opacity-50"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
