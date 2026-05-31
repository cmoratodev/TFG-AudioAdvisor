import { ImageResponse } from 'next/og'

/**
 * OpenGraph card shown when an Audio Advisor link is pasted into Twitter,
 * WhatsApp, Slack, LinkedIn, Discord, etc. 1200 × 630 is the size most
 * platforms render best.
 *
 * Visual matches the auth split panel: dark surface, violet glow,
 * decorative waveform, headline + tagline. No imagery to keep alive — it's
 * all programmatic.
 */
export const alt = 'Audio Advisor — Feedback técnico de audio sin concesiones'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background:
            'radial-gradient(ellipse 70% 60% at 30% 30%, rgba(124, 58, 237, 0.35), transparent 70%), linear-gradient(to bottom right, #18181b 0%, #09090b 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative bars in the background, lower right corner */}
        <div
          style={{
            position: 'absolute',
            right: 60,
            bottom: 60,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            opacity: 0.18,
          }}
        >
          {[60, 120, 90, 200, 150, 240, 110, 180, 80, 220, 130, 160].map((h, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 8,
                height: h,
                background: '#a78bfa',
                borderRadius: 2,
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 6,
              color: '#a78bfa',
              textTransform: 'uppercase',
            }}
          >
            Audio Advisor
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 880 }}>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
            }}
          >
            Feedback técnico de audio,{' '}
            <span style={{ color: '#a78bfa' }}>sin concesiones.</span>
          </span>
          <span
            style={{
              fontSize: 26,
              color: '#a1a1aa',
              lineHeight: 1.4,
              marginTop: 24,
              maxWidth: 720,
            }}
          >
            Sube tu pista, recibe comentarios anclados al segundo y desbloquea rangos.
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
