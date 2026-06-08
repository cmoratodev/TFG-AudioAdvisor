'use client'

import { useCallback, useMemo, useRef } from 'react'

interface Props {
  /** Pre-computed normalized peaks (0..1). Already downsampled to ~1800 bars. */
  peaks: number[]
  /** Current playback position in seconds. */
  currentTime: number
  /** Total duration in seconds. */
  duration: number
  /** Called with the new time when the user clicks/drags on the bar. */
  onSeek: (seconds: number) => void
}

/**
 * Mini-onda interactiva del reproductor global. Los picos se sub-muestrean
 * a un número fijo de barras (60) para que la visualización sea legible a
 * cualquier ancho, independientemente de la resolución original.
 */
const VISIBLE_BARS = 60

export function PlayerWaveSeek({ peaks, currentTime, duration, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Sub-muestreo a VISIBLE_BARS valores tomando el máximo de cada bin.
  const bars = useMemo(() => {
    if (peaks.length === 0) return [] as number[]
    if (peaks.length <= VISIBLE_BARS) return peaks
    const out: number[] = []
    const binSize = peaks.length / VISIBLE_BARS
    for (let i = 0; i < VISIBLE_BARS; i++) {
      const start = Math.floor(i * binSize)
      const end = Math.floor((i + 1) * binSize)
      let max = 0
      for (let j = start; j < end; j++) {
        const v = peaks[j]
        if (v > max) max = v
      }
      out.push(max)
    }
    return out
  }, [peaks])

  const progress = duration > 0 ? currentTime / duration : 0

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el || duration <= 0) return
      const rect = el.getBoundingClientRect()
      const ratio = (clientX - rect.left) / rect.width
      const clamped = Math.max(0, Math.min(1, ratio))
      onSeek(clamped * duration)
    },
    [duration, onSeek],
  )

  if (bars.length === 0) {
    // Sin picos disponibles para esta pista.
    return null
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Posición de la pista"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onClick={(e) => seekFromPointer(e.clientX)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5))
        else if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5))
      }}
      className="relative w-full h-7 flex items-center cursor-pointer group select-none"
    >
      <div className="absolute inset-0 flex items-center gap-[2px]">
        {bars.map((peak, i) => {
          const barProgress = i / bars.length
          const isPlayed = barProgress < progress
          // Minimum height so even silent passages are visible.
          const heightPct = Math.max(12, peak * 100)
          return (
            <span
              key={i}
              className={`flex-1 rounded-sm transition-colors ${
                isPlayed ? 'bg-violet-600' : 'bg-zinc-300 group-hover:bg-zinc-400'
              }`}
              style={{ height: `${heightPct}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
