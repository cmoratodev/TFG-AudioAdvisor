'use client'

import { SVG3D } from '3dsvg'

/**
 * Animated 3D waveform-style hero ornament. Rendered by `3dsvg`, which builds
 * a Three.js scene under the hood. We isolate it in its own client component
 * so the Home page can stay a Server Component and only lazy-load this WebGL
 * canvas in the browser via `next/dynamic({ ssr: false })`.
 *
 * The text glyphs (`I|||I||II|||I||I`) read as a stylized waveform silhouette
 * when extruded — perfect visual metaphor for an audio-feedback product.
 */
export function Hero3D() {
  return (
    <SVG3D
      text="I|||I||II|||I||I"
      font="Righteous"
      depth={0.8}
      smoothness={0.6}
      color="#393838"
      material="metal"
      metalness={0.9}
      roughness={0.2}
      animate="spinFloat"
      animateSpeed={1.7}
      zoom={6.5}
    />
  )
}
