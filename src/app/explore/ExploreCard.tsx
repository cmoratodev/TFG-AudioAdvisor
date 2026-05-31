'use client'

import Link from 'next/link'
import { Play, Activity, MessageCircle } from 'lucide-react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { RankBadge } from '@/components/ui/RankBadge'
import { TrackCover } from '@/components/track/TrackCover'
import type { TrackData } from '@/types'
import type { UserLevel } from '@prisma/client'

interface Props {
  track: TrackData & { authorLevel: UserLevel; commentCount: number }
  /** Sibling tracks shown in the same view — used as the playback queue. */
  queue: TrackData[]
}

/**
 * Client island for the Explore grid: the card itself can be SSR'd, but the
 * "Reproducir" button needs the Zustand store + a queue passed down from the
 * server-rendered list. Keeping this as a thin wrapper lets the page stay a
 * Server Component while preserving the existing card visuals.
 */
export function ExploreCard({ track, queue }: Props) {
  const playTrack = usePlayerStore((s) => s.playTrack)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlayingThis = currentTrack?.id === track.id

  return (
    <div className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 transition-colors shadow-sm hover:shadow-md">
      <div className="aspect-square relative border-b border-zinc-100 overflow-hidden">
        <TrackCover track={track} className="w-full h-full rounded-none" />

        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <Link
            href={`/track/${track.id}`}
            className="w-12 h-12 rounded-full bg-white border border-zinc-200 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white flex items-center justify-center text-zinc-950 shadow-sm transition-all"
            title="Abrir Onda y Feedback"
            aria-label={`Abrir ${track.title}`}
          >
            <Activity size={20} />
          </Link>
          <button
            onClick={() => playTrack(track, queue)}
            className="w-12 h-12 rounded-full bg-white border border-zinc-200 text-zinc-950 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm transition-all"
            title="Reproducir de fondo"
            aria-label={`Reproducir ${track.title}`}
          >
            <Play size={20} className="translate-x-[2px]" />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <Link
              href={`/track/${track.id}`}
              className="font-bold tracking-tight text-lg text-zinc-950 hover:underline truncate block"
            >
              {track.title}
            </Link>
            <Link
              href={track.authorId ? `/profile/${track.authorId}` : '#'}
              className="text-zinc-500 font-medium hover:text-zinc-950 hover:underline truncate block text-sm"
            >
              {track.author}
            </Link>
          </div>
          {isPlayingThis && (
            <div
              className="flex gap-[2px] h-4 items-end mt-1 shrink-0"
              title="Reproduciendo ahora"
              aria-label="Reproduciendo ahora"
            >
              <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0ms] h-full rounded-t-sm" />
              <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0.2s] h-3/4 rounded-t-sm" />
              <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0.4s] h-full rounded-t-sm" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2 min-w-0">
            <RankBadge level={track.authorLevel} size="xs" showName={false} />
            {track.genre && (
              <span className="inline-block px-2 py-0.5 bg-zinc-100 rounded-md text-xs font-semibold text-zinc-600 truncate">
                {track.genre}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0 tabular-nums">
            <MessageCircle size={12} />
            {track.commentCount}
          </span>
        </div>
      </div>
    </div>
  )
}
