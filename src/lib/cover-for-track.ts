/**
 * Devuelve la URL de la portada que debe mostrarse para una pista.
 * Prioridad: cover propio > imagen por género > fallback "otro".
 */

const KNOWN_GENRES = new Set([
  'electronica',
  'pop',
  'hip-hop',
  'acustico',
  'jazz',
  'rock',
  'otro',
])

function slugifyGenre(genre: string | null | undefined): string {
  if (!genre) return 'otro'
  const slug = genre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return KNOWN_GENRES.has(slug) ? slug : 'otro'
}

export function coverForTrack(track: {
  coverUrl?: string | null
  genre?: string | null
}): string {
  if (track.coverUrl) return track.coverUrl
  return `/genres/${slugifyGenre(track.genre)}.webp`
}
