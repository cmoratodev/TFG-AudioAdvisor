/**
 * Global "page atmosphere" rendered once in the root layout.
 *
 * Sits fixed behind every page so the light hero glow + grain travel with
 * the viewport as the user scrolls, instead of being baked into a single
 * section. Resend's marketing site uses the same trick — the diagonal
 * studio-light beam + film grain combo gives a flat-color page real
 * tactility without competing with the actual content.
 *
 * Three stacked layers, top to bottom (CSS short-hand order):
 *
 *   1. A faint warm-violet radial in the top-right corner. Mirrors where
 *      the Hero 3D ornament sits on `/` — the eye reads it as a soft
 *      key-light hitting the scene.
 *   2. A cooler complementary radial low-left, providing visual balance.
 *   3. A diagonal violet beam at ~120°. Subtle (≤7 % opacity) so it never
 *      reads as a "gradient banner" — just adds compositional direction.
 *   4. The base off-white tint. Vertically graded toward a slightly
 *      cooler bottom so cards always look "lifted".
 *
 * Plus an SVG noise overlay (`feTurbulence`) at very low opacity for the
 * filmic texture. Multiply blend mode so it darkens rather than lightens —
 * matches how analog grain shows up on a print.
 *
 * `pointer-events-none` and `aria-hidden` keep the layer purely decorative.
 * `fixed inset-0 -z-10` parks it behind every other body child without
 * needing a wrapper around the rest of the layout.
 */

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden>
      {/* Tone + gradients layer.
       *
       * Composed for *depth*, not for "this corner is brighter". A single
       * concentrated radial reads as a stain; instead we layer:
       *
       *   1. A wide vignette — corners ~3 % darker than the centre. The eye
       *      reads non-uniform luminance as a three-dimensional surface.
       *   2. A page-spanning diagonal wash. Very low opacity, very wide
       *      band; impossible to pinpoint where the colour "lives", so it
       *      registers as ambient temperature rather than a feature.
       *   3. A bottom-edge cool fade. Pulls the page down visually, like
       *      stage lighting with a darker floor.
       *   4. The off-white base tint.
       */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            // 1. Vignette — softer; gives depth without compressing the
            //    page visually.
            'radial-gradient(ellipse 130% 110% at 50% 45%, transparent 50%, rgba(30, 27, 75, 0.07) 100%)',
            // 2. Diagonal violet wash — present but no longer the main
            //    character. Reduced opacity so the page still reads as
            //    near-white, not "tinted page".
            'linear-gradient(125deg, transparent 15%, rgba(124, 58, 237, 0.06) 50%, transparent 85%)',
            // 3. Bottom shade — barely there, just enough to weight the
            //    composition.
            'linear-gradient(180deg, transparent 60%, rgba(30, 27, 75, 0.035) 100%)',
            // 4. Base tint — much closer to white, only a whisper of brand
            //    temperature. The gradients on top do the heavy lifting.
            'linear-gradient(to bottom, #fbfaff 0%, #f5f3fb 100%)',
          ].join(', '),
        }}
      />

      {/* Film grain. Slightly toned down to match the lighter ambient. */}
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-multiply"
        style={{
          backgroundImage: `url("${NOISE_SVG}")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </div>
  )
}
