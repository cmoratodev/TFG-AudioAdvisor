import { ImageResponse } from 'next/og'

/**
 * Apple touch icon (iOS home screen / Safari pinned tab). Same waveform
 * silhouette as the favicon but at the dimensions iOS expects, with
 * proportionally taller bars so they read at home-screen scale.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          gap: 8,
          borderRadius: 40,
        }}
      >
        {[40, 80, 60, 120, 100, 140, 80, 50].map((h, i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 10,
              height: h,
              background: '#a78bfa',
              borderRadius: 4,
            }}
          />
        ))}
      </div>
    ),
    { ...size },
  )
}
