'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { coverForTrack } from '@/lib/cover-for-track'
import { coverGradient } from '@/lib/cover-gradient'

interface Props {
  /** Used to derive the URL: user's `coverUrl` first, then per-genre default. */
  track: {
    id: string
    title: string
    coverUrl?: string | null
    genre?: string | null
  }
  /** Tailwind classes for the outer wrapper (size, rounding, shadow, …). */
  className?: string
  /** Decorative covers (e.g. inside a labeled card) should pass `''` here so
   * the alt is empty and screen readers skip the duplicate. */
  alt?: string
}

/**
 * Resilient cover thumbnail.
 *
 *   1. Tries `coverForTrack()` (uploaded URL or `/genres/<slug>.jpg`).
 *   2. If the image fails to load (e.g. genre default not yet in /public),
 *      swaps to a deterministic CSS gradient so the UI never shows a
 *      broken-image glyph. The gradient is seeded by the track id + title
 *      so the same track keeps the same color across reloads.
 *
 * Used by the global AudioPlayer, Explore grid and the My Tracks / Profile
 * rows so a track has consistent visual identity wherever it appears.
 */
export function TrackCover({ track, className = 'w-12 h-12 rounded-lg', alt }: Props) {
  const src = coverForTrack(track)
  const [errored, setErrored] = useState(false)

  // Reset the errored state when the underlying URL changes (e.g. the user
  // navigates the queue) so a previously-failed cover gets a fresh attempt
  // for the next track.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrored(false)
  }, [src])

  if (errored) {
    const gradient = coverGradient(`${track.id}-${track.title}`)
    return (
      <div
        className={`${className} shrink-0 ring-1 ring-black/5 shadow-sm`}
        style={{ background: gradient.background }}
        aria-hidden
      />
    )
  }

  // `<Image fill>` requires a positioned parent — we wrap so the consumer
  // doesn't have to manage `relative` on every cover usage. Resized via
  // `sizes` so the optimizer picks an appropriate srcset entry.
  return (
    <div className={`${className} shrink-0 relative overflow-hidden shadow-sm`}>
      <Image
        src={src}
        alt={alt ?? `Portada de ${track.title}`}
        fill
        sizes="(max-width: 640px) 96px, (max-width: 1024px) 192px, 256px"
        className="object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  )
}
