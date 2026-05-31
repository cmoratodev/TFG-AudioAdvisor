'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Loader2, X } from 'lucide-react'
import { toast } from '@/store/useToastStore'
import { usePlayerStore } from '@/store/usePlayerStore'

interface Props {
  trackId: string
  initialTitle: string
  initialGenre: string | null
}

const GENRES = ['Electrónica', 'Pop', 'Hip Hop', 'Acústico', 'Jazz', 'Rock', 'Otro'] as const

/**
 * Pencil button + modal for editing a track's title and genre.
 *
 * Rendered only for the owner in TrackDetails. Modal closes on Escape /
 * backdrop click / successful save; on success we both toast the user and
 * `router.refresh()` so the server-rendered title block updates without a
 * hard reload. If the edited track is the one currently playing in the
 * global AudioPlayer, we patch its title in the Zustand store too so the
 * bottom bar stays consistent.
 */
export function EditTrackButton({ trackId, initialTitle, initialGenre }: Props) {
  const router = useRouter()
  const replaceCurrentTrack = usePlayerStore((s) => s.replaceCurrentTrack)
  const currentTrack = usePlayerStore((s) => s.currentTrack)

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [genre, setGenre] = useState(initialGenre ?? 'Otro')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset form to the latest props every time the modal opens. Without this,
  // a successful edit followed by a re-open would still show the previous
  // values until the page navigates somewhere else.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(initialTitle)
      setGenre(initialGenre ?? 'Otro')
      setError(null)
    }
  }, [open, initialTitle, initialGenre])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tracks/${trackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), genre: genre || null }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo guardar.')
        return
      }
      if (currentTrack?.id === trackId) {
        replaceCurrentTrack({ ...currentTrack, title: title.trim() })
      }
      toast.success('Pista actualizada')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar título y género"
        title="Editar título y género"
        className="text-zinc-400 hover:text-zinc-950 transition-colors p-1.5 -m-1.5 rounded-md"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-track-title"
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => !saving && setOpen(false)}
            aria-hidden
          />
          {/* Card */}
          <div
            ref={dialogRef}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 animate-in fade-in zoom-in-95"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              disabled={saving}
              className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-950 transition-colors p-1 disabled:opacity-50"
            >
              <X size={16} />
            </button>

            <h2 id="edit-track-title" className="text-xl font-bold tracking-tight mb-1">
              Editar pista
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Cambia el título o el género. El audio y los comentarios no se ven afectados.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-title"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
                >
                  Título
                </label>
                <input
                  id="edit-title"
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-genre"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5"
                >
                  Género
                </label>
                <select
                  id="edit-genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 transition"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-xs text-red-600 font-medium px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving}
                  className="px-4 h-10 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="px-5 h-10 rounded-lg bg-zinc-950 text-white text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
