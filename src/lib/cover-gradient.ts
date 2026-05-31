/**
 * Derives a stable two-stop CSS gradient from a track's title + id. Used as
 * a placeholder cover everywhere we don't have a real image: the global
 * AudioPlayer, the Explore grid, My Tracks rows.
 *
 * Stable means: same input → same colors across reloads, devices, and users.
 * No randomness, no Date.now() — just a tiny hash of the seed text.
 */
function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0 // force 32-bit
  }
  return Math.abs(hash)
}

export interface CoverGradient {
  /** Ready-to-use CSS `background` value (linear-gradient at 135deg). */
  background: string
  /** Hue used as the dominant color — handy when the consumer wants a matching ring/border. */
  hue: number
}

export function coverGradient(seed: string): CoverGradient {
  const hash = hashString(seed || 'untitled')
  const hue = hash % 360
  // Complementary-ish second stop (≈ 40° away) for visual interest without
  // clashing. Saturation kept high, lightness mid so the cover always reads
  // strong on both light and dark surrounding UI.
  const hue2 = (hue + 40) % 360
  const c1 = `hsl(${hue}, 70%, 55%)`
  const c2 = `hsl(${hue2}, 75%, 45%)`
  return {
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    hue,
  }
}
