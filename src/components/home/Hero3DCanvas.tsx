'use client'

import dynamic from 'next/dynamic'

/**
 * Client island that lazy-loads the Three.js-backed 3D hero ornament. The
 * surrounding `<HeroSection>` in `app/page.tsx` is a Server Component, but
 * `next/dynamic({ ssr: false })` only works from inside a Client Component
 * in Next 16+ — so this thin wrapper exists purely to host the dynamic call.
 *
 * While `three` + the SVG3D scene are still loading, we render a CSS-only
 * pulsing waveform placeholder so the layout doesn't jump.
 */
const Hero3D = dynamic(() => import('@/components/home/Hero3D').then((m) => m.Hero3D), {
  ssr: false,
  loading: () => <Hero3DPlaceholder />,
})

export function Hero3DCanvas() {
  return <Hero3D />
}

function Hero3DPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center" aria-hidden>
      <div className="flex items-end gap-1 h-1/2 w-2/3 opacity-30">
        {Array.from({ length: 32 }, (_, i) => (
          <span
            key={i}
            className="flex-1 bg-zinc-200 rounded-sm animate-pulse"
            style={{
              height: `${30 + ((i * 17) % 60)}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
