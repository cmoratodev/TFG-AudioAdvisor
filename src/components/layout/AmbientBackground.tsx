/**
 * Fondo decorativo global compuesto por un degradado violeta + ruido SVG.
 * Se monta una vez en el layout raíz y queda fijo detrás del contenido.
 */

const NOISE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>`

export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 130% 110% at 50% 45%, transparent 50%, rgba(30, 27, 75, 0.07) 100%)',
            'linear-gradient(125deg, transparent 15%, rgba(124, 58, 237, 0.06) 50%, transparent 85%)',
            'linear-gradient(180deg, transparent 60%, rgba(30, 27, 75, 0.035) 100%)',
            'linear-gradient(to bottom, #fbfaff 0%, #f5f3fb 100%)',
          ].join(', '),
        }}
      />

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
