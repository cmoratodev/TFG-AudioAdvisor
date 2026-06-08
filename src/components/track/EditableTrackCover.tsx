'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, X } from 'lucide-react'
import { TrackCover } from '@/components/track/TrackCover'
import { usePlayerStore } from '@/store/usePlayerStore'
import { toast } from '@/store/useToastStore'

interface Props {
  track: {
    id: string
    title: string
    coverUrl?: string | null
    genre?: string | null
  }
  /** Sólo el dueño de la pista ve el overlay de edición. */
  isOwner: boolean
  /** Clases Tailwind del contenedor (tamaño y bordes). */
  className?: string
}

const ACCEPTED_COVER_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_COVER_MB = 5

/** Portada editable: hover muestra overlay para subir nueva imagen. */
export function EditableTrackCover({
  track,
  isOwner,
  className = 'w-20 h-20 sm:w-24 sm:h-24 rounded-xl',
}: Props) {
  const router = useRouter()
  const replaceCurrentTrack = usePlayerStore((s) => s.replaceCurrentTrack)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const triggerPicker = () => {
    if (uploading) return
    setError(null)
    inputRef.current?.click()
  }

  const submitFile = async (file: File) => {
    if (!ACCEPTED_COVER_MIME.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setError(`La portada supera ${MAX_COVER_MB} MB.`)
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('cover', file)
      const res = await fetch(`/api/tracks/${track.id}/cover`, {
        method: 'PATCH',
        body: form,
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo cambiar la portada.')
        return
      }
      const { coverUrl } = (await res.json()) as { coverUrl: string | null }
      // Actualiza el player en memoria si la pista editada está sonando.
      if (currentTrack?.id === track.id) {
        replaceCurrentTrack({ ...currentTrack, coverUrl: coverUrl ?? undefined })
      }
      toast.success('Portada actualizada')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (selected) void submitFile(selected)
  }

  return (
    <div className="relative shrink-0">
      <div className={`relative ${className} overflow-hidden ring-1 ring-black/5 shadow-sm`}>
        <TrackCover
          track={track}
          className="absolute inset-0 w-full h-full rounded-none"
        />

        {isOwner && (
          <button
            type="button"
            onClick={triggerPicker}
            disabled={uploading}
            aria-label={uploading ? 'Subiendo portada' : 'Cambiar portada'}
            title={uploading ? 'Subiendo…' : 'Cambiar portada'}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/55 focus-visible:bg-black/55 transition-colors text-white opacity-0 hover:opacity-100 focus-visible:opacity-100 disabled:cursor-wait gap-1"
          >
            {uploading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <Camera size={20} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Cambiar
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {isOwner && (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
        />
      )}

      {error && (
        <div
          role="alert"
          className="absolute top-full left-0 mt-2 z-20 w-64 flex items-start gap-2 text-xs text-red-700 font-medium px-3 py-2 bg-red-50 border border-red-200 rounded-lg shadow-md"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar mensaje de error"
            className="text-red-500 hover:text-red-700 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
