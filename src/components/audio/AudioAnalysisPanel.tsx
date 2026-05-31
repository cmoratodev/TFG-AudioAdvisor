'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  MessageSquarePlus,
  BarChart3,
  Globe,
  AudioLines,
  Layers,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import type {
  AnalysisIssue,
  AnalysisMetrics,
  AnalysisResult,
  BandEnergies,
} from '@/lib/audio-analysis-types'
import { toast } from '@/store/useToastStore'

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const formatDb = (db: number): string => {
  if (!Number.isFinite(db)) return '−∞'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

interface Props {
  /**
   * Server-computed analysis. `null` when the upload-time decode failed or
   * for legacy versions that haven't been backfilled — we surface the empty
   * state instead of running anything on the client.
   */
  result: AnalysisResult | null
  /**
   * Called when the user clicks "Comentar" on an issue. The parent should
   * open the comment draft at the given timestamp with `suggestion` pre-filled.
   */
  onCommentIssue: (issue: AnalysisIssue) => void
  /** Optional: highlighted/active issue id (e.g. the one currently being drafted). */
  activeIssueId?: string | null
  /**
   * Track id and ownership flag to enable the "Re-analizar" admin action.
   * Hidden for non-owners. Triggers `/api/tracks/[id]/reanalyze` which
   * re-runs the FFT + detectors on every version's stored audio.
   */
  trackId?: string
  isOwner?: boolean
}

const severityClass: Record<AnalysisIssue['severity'], { dot: string; chip: string }> = {
  critical: {
    dot: 'bg-red-500',
    chip: 'bg-red-50 border-red-200 text-red-700',
  },
  warning: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 border-amber-200 text-amber-700',
  },
}

/**
 * Group consecutive same-kind issues that are close in time into one row.
 * 10 s is roughly a "musical phrase" — events further apart probably belong
 * to different sections (verse vs chorus), closer events are essentially the
 * same problem repeating.
 */
const CLUSTER_GAP_SECONDS = 10

function clusterIssues(issues: AnalysisIssue[]): AnalysisIssue[][] {
  if (issues.length === 0) return []
  const sorted = [...issues].sort((a, b) => a.start - b.start)
  const clusters: AnalysisIssue[][] = []
  let current: AnalysisIssue[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    const last = current[current.length - 1]
    const sameKind = next.kind === last.kind
    const closeInTime = next.start - last.end <= CLUSTER_GAP_SECONDS
    // Never cluster global issues (they're already track-wide singletons).
    const bothLocal = next.scope === 'local' && last.scope === 'local'
    if (sameKind && closeInTime && bothLocal) {
      current.push(next)
    } else {
      clusters.push(current)
      current = [next]
    }
  }
  clusters.push(current)
  return clusters
}

export function AudioAnalysisPanel({
  result,
  onCommentIssue,
  activeIssueId,
  trackId,
  isOwner,
}: Props) {
  const router = useRouter()
  const issueCount = result?.issues.length ?? 0
  const [reanalyzing, setReanalyzing] = useState(false)

  const onReanalyze = async () => {
    if (!trackId || reanalyzing) return
    if (
      !confirm(
        'Esto reprocesa el audio de todas las versiones y reemplaza el análisis actual. ¿Continuar?',
      )
    )
      return
    setReanalyzing(true)
    try {
      const res = await fetch(`/api/tracks/${trackId}/reanalyze`, { method: 'POST' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error('No se pudo re-analizar', data?.error)
        return
      }
      const { ok, failed } = (await res.json()) as { ok: number; failed: number }
      toast.success(
        'Análisis actualizado',
        failed > 0 ? `${ok} versión(es) re-analizada(s), ${failed} con error` : undefined,
      )
      router.refresh()
    } finally {
      setReanalyzing(false)
    }
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
            <span aria-hidden>🎧</span>
            Análisis automático
          </span>
          {result && (
            <span className="text-xs font-mono px-2 py-0.5 bg-zinc-100 rounded-full text-zinc-600">
              {issueCount} detectado{issueCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {isOwner && trackId && (
          <button
            type="button"
            onClick={() => void onReanalyze()}
            disabled={reanalyzing}
            aria-label="Re-analizar pista"
            title="Vuelve a procesar el audio con los detectores actuales"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 border border-zinc-200 hover:border-zinc-950 rounded-full px-3 py-1 transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            {reanalyzing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {reanalyzing ? 'Re-analizando…' : 'Re-analizar'}
          </button>
        )}
      </header>

      <div className="px-5 py-4">
        {!result ? (
          <p className="text-sm text-zinc-500">
            Sin análisis disponible para esta versión. Sube una nueva revisión para regenerarlo.
          </p>
        ) : result.issues.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-emerald-700">
            <ShieldCheck size={18} className="text-emerald-600" />
            Sin problemas técnicos detectados. ¡Buen trabajo!
          </div>
        ) : (
          <ul className="space-y-2">
            {clusterIssues(result.issues).map((cluster) => {
              if (cluster.length === 1) {
                const issue = cluster[0]
                return (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    isActive={activeIssueId === issue.id}
                    onComment={() => onCommentIssue(issue)}
                  />
                )
              }
              return (
                <ClusterRow
                  key={`cluster-${cluster[0].id}`}
                  cluster={cluster}
                  isActive={cluster.some((i) => i.id === activeIssueId)}
                  onComment={(issue) => onCommentIssue(issue)}
                />
              )
            })}
          </ul>
        )}
      </div>

      {result && (
        <footer className="border-t border-zinc-100 bg-zinc-50/50">
          <div className="px-5 py-3">
            <MetricsRow metrics={result.metrics} duration={result.duration} />
          </div>
          {result.metrics.bands && (
            <>
              <div className="border-t border-zinc-200 mx-5" />
              <div className="px-5 py-4">
                <SpectrumBars bands={result.metrics.bands} issues={result.issues} />
              </div>
            </>
          )}
          {result.issues.length > 0 && (
            <div className="border-t border-zinc-100 px-5 py-2 text-[11px] text-zinc-500">
              Estas son sugerencias automáticas, no errores definitivos. Confirma con tu oído antes
              de enviar el feedback.
            </div>
          )}
        </footer>
      )}
    </section>
  )
}

interface SpectrumBarsProps {
  bands: BandEnergies
  issues: AnalysisIssue[]
}

const BAND_KEYS: ReadonlyArray<{ key: keyof BandEnergies; label: string; full: string }> = [
  { key: 'sub', label: 'SUB', full: 'Sub-bajos (20–80 Hz)' },
  { key: 'bass', label: 'BASS', full: 'Bajos (80–250 Hz)' },
  { key: 'lowMids', label: 'LM', full: 'Low-mids (250–500 Hz)' },
  { key: 'mids', label: 'MID', full: 'Medios (500–2000 Hz)' },
  { key: 'upperMids', label: 'UM', full: 'Upper-mids (2–4 kHz)' },
  { key: 'presence', label: 'PRES', full: 'Presencia (4–8 kHz)' },
  { key: 'brilliance', label: 'BRIL', full: 'Brillo (8–16 kHz)' },
]

/** Map issue kinds to the band they relate to, for visual highlighting. */
const KIND_TO_BAND: Partial<Record<AnalysisIssue['kind'], keyof BandEnergies>> = {
  muddy: 'lowMids',
  harsh: 'presence',
  'weak-low-end': 'bass',
  dull: 'brilliance',
}

function SpectrumBars({ bands, issues }: SpectrumBarsProps) {
  const finiteValues = BAND_KEYS.map(({ key }) => bands[key]).filter((v) => Number.isFinite(v))
  if (finiteValues.length === 0) return null

  const min = Math.min(...finiteValues)
  const max = Math.max(...finiteValues)
  const range = Math.max(1, max - min)

  const flagged = new Set<keyof BandEnergies>()
  for (const issue of issues) {
    const band = KIND_TO_BAND[issue.kind]
    if (band) flagged.add(band)
  }

  return (
    <div className="flex items-end gap-3">
      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-700 font-sans font-semibold pb-5 shrink-0">
        <AudioLines size={11} aria-hidden />
        Espectro
      </span>
      <div className="flex items-end gap-1 h-12 flex-1 min-w-0">
        {BAND_KEYS.map(({ key, label, full }) => {
          const value = bands[key]
          const isValid = Number.isFinite(value)
          const heightPct = isValid ? Math.max(6, ((value - min) / range) * 100) : 6
          const isFlagged = flagged.has(key)
          const barColor = isFlagged
            ? 'bg-amber-500'
            : key === 'mids'
              ? 'bg-zinc-700'
              : 'bg-zinc-400'
          return (
            <div key={key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="w-full h-10 flex items-end">
                <div
                  className={`w-full rounded-t ${barColor} transition-all`}
                  style={{ height: `${heightPct}%` }}
                  title={`${full}: ${isValid ? `${value.toFixed(1)} dB` : '−∞'}`}
                />
              </div>
              <span
                className={`text-[9px] font-mono ${isFlagged ? 'text-amber-700 font-semibold' : 'text-zinc-500'}`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricsRow({ metrics, duration }: { metrics: AnalysisMetrics; duration: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 font-mono">
      <span className="inline-flex items-center gap-1 text-zinc-600">
        <BarChart3 size={11} aria-hidden />
        <span className="font-sans font-semibold text-zinc-700">Resumen</span>
      </span>
      <span>
        Peak <span className="text-zinc-950 font-semibold">{formatDb(metrics.peakDb)}</span>
        <span className="text-zinc-400"> @ {formatClock(metrics.peakAt)}</span>
      </span>
      <span>
        RMS <span className="text-zinc-950 font-semibold">{formatDb(metrics.rmsDb)}</span>
      </span>
      <span>
        Crest{' '}
        <span className="text-zinc-950 font-semibold">{metrics.crestFactorDb.toFixed(1)} dB</span>
      </span>
      <span>
        Duración <span className="text-zinc-950 font-semibold">{formatClock(duration)}</span>
      </span>
    </div>
  )
}

interface IssueRowProps {
  issue: AnalysisIssue
  isActive: boolean
  onComment: () => void
}

function IssueRow({ issue, isActive, onComment }: IssueRowProps) {
  const cls = severityClass[issue.severity]
  const Icon = issue.severity === 'critical' ? AlertOctagon : AlertTriangle
  return (
    <li
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isActive ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`}
          aria-hidden
        />
        <Icon
          size={14}
          className={issue.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}
          aria-hidden
        />
        <span className="text-sm font-medium text-zinc-950 truncate">{issue.title}</span>
        {issue.scope === 'global' ? (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls.chip}`}
            title="Afecta a toda la canción"
          >
            <Globe size={10} aria-hidden />
            Toda la canción
          </span>
        ) : (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cls.chip}`}>
            {formatClock(issue.start)}
            {issue.end - issue.start > 0.5 ? `–${formatClock(issue.end)}` : ''}
          </span>
        )}
      </div>
      <button
        onClick={onComment}
        className="flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-white hover:bg-zinc-950 border border-zinc-200 hover:border-zinc-950 px-2.5 py-1 rounded-full transition-colors shrink-0"
      >
        <MessageSquarePlus size={12} />
        Comentar
      </button>
    </li>
  )
}

interface ClusterRowProps {
  cluster: AnalysisIssue[]
  isActive: boolean
  onComment: (issue: AnalysisIssue) => void
}

function ClusterRow({ cluster, isActive, onComment }: ClusterRowProps) {
  const first = cluster[0]
  const last = cluster[cluster.length - 1]
  const cls = severityClass[first.severity]
  const Icon = first.severity === 'critical' ? AlertOctagon : AlertTriangle

  // Use the first issue's metadata as the representative; augment the
  // suggestion so the user understands they're commenting on a region with
  // multiple occurrences.
  const summaryIssue: AnalysisIssue = {
    ...first,
    suggestion: `Hay ${cluster.length} eventos de "${first.title.toLowerCase()}" entre ${formatClock(
      first.start,
    )} y ${formatClock(last.end)}. ${first.suggestion}`,
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
        isActive ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cls.dot}`} aria-hidden />
        <Icon
          size={14}
          className={first.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}
          aria-hidden
        />
        <span className="text-sm font-medium text-zinc-950 truncate">{first.title}</span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls.chip}`}
          title={`${cluster.length} eventos detectados en este tramo`}
        >
          <Layers size={10} aria-hidden />
          {cluster.length} eventos
        </span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cls.chip}`}>
          {formatClock(first.start)}–{formatClock(last.end)}
        </span>
      </div>
      <button
        onClick={() => onComment(summaryIssue)}
        className="flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-white hover:bg-zinc-950 border border-zinc-200 hover:border-zinc-950 px-2.5 py-1 rounded-full transition-colors shrink-0"
      >
        <MessageSquarePlus size={12} />
        Comentar
      </button>
    </li>
  )
}
