import type { Metadata } from 'next'
import Link from 'next/link'
import { Upload, AudioLines, MessageSquareText, ArrowRight } from 'lucide-react'

import { RANK_TIERS } from '@/lib/ranks'
import { Hero3DCanvas } from '@/components/home/Hero3DCanvas'

export const metadata: Metadata = {
  // The Home page is the only one that wants the literal product name as
  // its tab title (without the " · Audio Advisor" suffix the template adds).
  title: { absolute: 'Audio Advisor — Feedback técnico de audio sin concesiones' },
  description:
    'Sube tus pistas y recibe comentarios técnicos anclados al segundo. Análisis automático de clipping, dinámica y problemas espectrales. De Hierro a Leyenda según tu actividad.',
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      <HeroSection />
      <HowItWorksSection />
      <RanksSection />
    </div>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="container mx-auto px-4 pt-12 pb-20 sm:pt-20 sm:pb-28 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-600 mb-4">
            Audio Advisor
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-zinc-950 leading-[1.05]">
            Feedback de audio preciso.{' '}
            <span className="text-zinc-400">Sin concesiones.</span>
          </h1>
          <p className="mt-6 max-w-xl mx-auto lg:mx-0 text-lg text-zinc-600 font-medium leading-relaxed">
            Sube tus pistas y recibe comentarios anclados al segundo de productores reales. El
            análisis automático detecta clipping, exceso de medios y caídas de dinámica antes de que
            las preguntes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-zinc-950 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Empieza gratis
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 bg-white text-zinc-950 border border-zinc-200 px-7 py-3.5 rounded-full font-semibold hover:border-zinc-950 transition-colors"
            >
              Explorar pistas
            </Link>
          </div>
        </div>

        {/* 3D ornament — client island, see Hero3DCanvas.tsx */}
        <div className="relative h-[320px] sm:h-[400px] lg:h-[480px] flex items-center justify-center">
          <Hero3DCanvas />
        </div>
      </div>
    </section>
  )
}

// ─── How it works ──────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      icon: Upload,
      title: 'Sube tu pista',
      body: 'WAV o MP3, hasta 50 MB. En segundos tienes la onda renderizada y el análisis técnico listo.',
    },
    {
      icon: AudioLines,
      title: 'Análisis automático',
      body: 'Detectamos clipping, picos, silencios, dinámica baja y problemas espectrales. Cada hallazgo apunta al segundo exacto.',
    },
    {
      icon: MessageSquareText,
      title: 'Feedback humano',
      body: 'Otros productores comentan sobre la onda. Marca los útiles, gana XP, sube de rango.',
    },
  ]

  // No section-level background. The ambient layer carries the colour
  // through every part of the page; the white cards below are what create
  // the visual rhythm (they "lift" off the violet ambient). Adding a
  // lighter strip here would invert the hierarchy — the strip would draw
  // the eye instead of the cards.
  return (
    <section>
      <div className="container mx-auto px-4 py-20 max-w-6xl">
        <div className="text-center mb-14">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 mb-3">
            Cómo funciona
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
            De la pista cruda al feedback en tres pasos.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title, body }, idx) => (
            <div
              key={title}
              className="relative bg-white border border-zinc-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="absolute top-5 right-5 text-xs font-mono text-zinc-400 tabular-nums">
                0{idx + 1}
              </span>
              <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 flex items-center justify-center mb-4">
                <Icon size={20} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-zinc-950">{title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Ranks ─────────────────────────────────────────────────────────────────

function RanksSection() {
  return (
    <section className="container mx-auto px-4 py-20 max-w-6xl">
      <div className="text-center mb-14">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-violet-600 mb-3">
          Rangos competitivos
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 mb-4">
          Cada feedback útil te acerca a la siguiente liga.
        </h2>
        <p className="text-zinc-600 font-medium max-w-2xl mx-auto">
          Sube pistas, comenta, recibe &quot;Útiles&quot; del autor: cada acción suma XP. Siete
          rangos, de Hierro a Leyenda.
        </p>
      </div>

      <div className="relative">
        {/* Horizontal progression line behind the badges */}
        <div
          aria-hidden
          className="hidden md:block absolute top-12 left-12 right-12 h-px bg-gradient-to-r from-zinc-200 via-violet-200 to-zinc-200"
        />
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 relative">
          {RANK_TIERS.map((tier) => (
            <li
              key={tier.key}
              className="bg-white border border-zinc-200 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white font-bold text-lg mb-3 shadow"
                style={{ backgroundColor: tier.color }}
                aria-hidden
              >
                {tier.icon}
              </div>
              <p className="font-bold text-sm text-zinc-950">{tier.name}</p>
              <p className="text-[10px] font-mono text-zinc-500 mt-1 tabular-nums">
                {tier.minXp.toLocaleString('es-ES')} XP
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14 text-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 bg-zinc-950 text-white px-7 py-3.5 rounded-full font-semibold hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Crear cuenta gratis
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}
