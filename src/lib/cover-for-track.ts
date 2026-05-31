/**
 * Resolves the cover image a track should show.
 *
 * Order of preference:
 *   1. The author's uploaded `coverUrl` if present.
 *   2. The default per-genre artwork in `/public/genres/<slug>.jpg`.
 *   3. A neutral fallback ("otro") if the genre is unknown or null.
 *
 * Genre slugging mirrors the upload form's `GENRES` array:
 *   "Hip Hop"     → "hip-hop"
 *   "Acústico"    → "acustico"  (accents stripped)
 *   "Electrónica" → "electronica"
 *   "Pop" / "Jazz" / "Rock" → lowercase
 *   anything else / null   → "otro"
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
    // Strip combining diacritical marks (U+0300 to U+036F).
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
  // Default genre covers are pre-processed into .webp by
  // `scripts/process-genre-covers.mts` (~95 % smaller than the source PNG).
  return `/genres/${slugifyGenre(track.genre)}.webp`
}
