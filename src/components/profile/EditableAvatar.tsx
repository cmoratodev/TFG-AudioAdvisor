'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Camera, Loader2, X, Trash2 } from 'lucide-react'
import { toast } from '@/store/useToastStore'

interface Props {
  /** Pre-existing avatar URL (null = use the colored initial fallback). */
  image: string | null
  /** Display name; first character is used in the initial-circle fallback. */
  name: string
  /** Background of the initial-circle fallback (typically the rank color). */
  fallbackColor: string
  /** Only the profile owner sees the edit overlay + actions. */
  isOwner: boolean
}

const ACCEPTED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_MB = 3

/**
 * Read-only avatar for visitors, editable for the owner.
 *
 *   - When `image` is null we render a colored initial (same look the rest
 *     of the app uses to talk about users in cards / lists).
 *   - For the owner, hovering reveals a camera-icon overlay; the file picker
 *     submits to `/api/profile/avatar` and on success patches the next-auth
 *     session locally so the navbar / track items refresh without a hard
 *     reload.
 *   - A small "remove" affordance under the avatar lets the owner revert to
 *     the initial-circle fallback (DELETE on the same endpoint).
 */
export function EditableAvatar({ image, name, fallbackColor, isOwner }: Props) {
  const router = useRouter()
  const { update: updateSession } = useSession()

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const triggerPicker = () => {
    if (uploading || removing) return
    setError(null)
    inputRef.current?.click()
  }

  const submitFile = async (file: File) => {
    if (!ACCEPTED_AVATAR_MIME.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setError(`La imagen supera ${MAX_AVATAR_MB} MB.`)
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo subir el avatar.')
        return
      }
      toast.success('Avatar actualizado')
      await updateSession()
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

  const removeAvatar = async () => {
    if (!confirm('¿Quitar tu avatar y volver a la inicial por defecto?')) return
    setRemoving(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (!res.ok) {
        setError('No se pudo quitar el avatar.')
        return
      }
      toast.success('Avatar eliminado')
      await updateSession()
      router.refresh()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-md ring-1 ring-black/5">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={`Avatar de ${name}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white"
            style={{ backgroundColor: fallbackColor }}
            aria-hidden
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={triggerPicker}
            disabled={uploading || removing}
            aria-label={uploading ? 'Subiendo avatar' : 'Cambiar avatar'}
            title={uploading ? 'Subiendo…' : 'Cambiar avatar'}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 hover:bg-black/60 focus-visible:bg-black/60 transition-colors text-white opacity-0 hover:opacity-100 focus-visible:opacity-100 disabled:cursor-wait gap-1"
          >
            {uploading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <Camera size={20} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Cambiar</span>
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

      {/* Owner-only remove action — only when there's something to remove. */}
      {isOwner && image && (
        <button
          type="button"
          onClick={() => void removeAvatar()}
          disabled={removing || uploading}
          className="mt-2 flex items-center gap-1 mx-auto text-[11px] font-medium text-zinc-500 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          <Trash2 size={11} />
          {removing ? 'Quitando…' : 'Quitar avatar'}
        </button>
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
