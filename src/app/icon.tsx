import { ImageResponse } from 'next/og'

/**
 * Programmatic favicon. Generated on demand by Next at build time (and
 * cached after), so we don't ship a binary asset and the brand mark stays
 * in lockstep with the rest of the design — pure CSS/SVG, no PNG to keep
 * in sync.
 *
 * The mark: a tight waveform silhouette in violet on the dark brand bg,
 * echoing the auth-shell decorative pattern at icon scale.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#09090b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          borderRadius: 6,
        }}
      >
        {/* Eight bars, monotonic peaks-style. Numbers chosen by eye so the
         * silhouette reads as "audio" at 32 × 32 — too uniform looks like
         * a barcode, too varied dissolves into noise. */}
        {[6, 14, 10, 22, 18, 24, 14, 8].map((h, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 2,
              height: h,
              background: '#a78bfa',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  )
}
