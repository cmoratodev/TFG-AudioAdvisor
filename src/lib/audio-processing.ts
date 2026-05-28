// NOTE: this module is server-only by intent (uses `audio-decode` which
// pulls in Node-only WASM workers + `Buffer`). We intentionally don't
// `import 'server-only'` so the same code can run from one-off Node scripts
// (e.g. `scripts/backfill-audio-processing.mts`). The route handlers that
// consume it (`POST /api/tracks*`) already pin `runtime = 'nodejs'`.
import decode from 'audio-decode'
import type {
  AnalysisIssue,
  AnalysisMetrics,
  AnalysisResult,
  BandEnergies,
} from '@/lib/audio-analysis-types'

/**
 * Server-side audio processing pipeline.
 *
 * On upload we decode the file ONCE and feed the same decoded sample data to
 * both the peak extractor (waveform UI) and the full analyzer (issue
 * detection). The client never re-downloads the audio for either purpose —
 * peaks and analysis travel through props from server components.
 *
 * Pure math: FFT, STFT, time-domain detectors and spectral checks were ported
 * verbatim from the previous Web Worker. No Web Audio / browser API is used
 * — the only browser concept we relied on (AudioContext.decodeAudioData) is
 * replaced by `audio-decode`, which yields `{ channelData, sampleRate }`.
 */

/** Number of visual bins in the rendered waveform. ~1800 matches SoundCloud. */
export const PEAKS_BIN_COUNT = 1800

interface DecodedAudio {
  channelData: Float32Array[]
  sampleRate: number
}

export interface ProcessedAudio {
  peaks: number[]
  duration: number
  sampleRate: number
  analysis: AnalysisResult | null
}

// ────────────────────────────────────────────────────────────────────────────
// Peaks
// ────────────────────────────────────────────────────────────────────────────

function computePeaks(audio: DecodedAudio, binCount: number): number[] {
  const channelData = audio.channelData
  const channels = channelData.length
  if (channels === 0) return []
  const samples = channelData[0].length
  if (samples === 0) return []

  const binSize = Math.max(1, Math.ceil(samples / binCount))
  const out: number[] = new Array(binCount).fill(0)

  for (let i = 0; i < binCount; i++) {
    const start = i * binSize
    const end = Math.min(start + binSize, samples)
    if (start >= samples) break

    let max = 0
    for (let c = 0; c < channels; c++) {
      const data = channelData[c]
      for (let j = start; j < end; j++) {
        const abs = Math.abs(data[j])
        if (abs > max) max = abs
      }
    }
    out[i] = max > 1 ? 1 : max
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// Mono mixdown — analysis needs a single channel of Float32 samples
// ────────────────────────────────────────────────────────────────────────────

function toMonoPcm(audio: DecodedAudio): Float32Array {
  const channels = audio.channelData.length
  if (channels === 0) return new Float32Array(0)
  const length = audio.channelData[0].length
  if (channels === 1) return audio.channelData[0]
  const mono = new Float32Array(length)
  for (let ch = 0; ch < channels; ch++) {
    const data = audio.channelData[ch]
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels
  }
  return mono
}

// ────────────────────────────────────────────────────────────────────────────
// Time-domain thresholds (Phase 1 + 2)
// ────────────────────────────────────────────────────────────────────────────

const CLIP_THRESHOLD = 0.99
const LOUD_PEAK_THRESHOLD = 0.891 // ≈ -1 dBFS
const MIN_CLIP_DURATION_MS = 1
const MERGE_GAP_MS = 250
const LOUD_PEAK_WINDOW_MS = 20
const LOUD_PEAK_MIN_DURATION_MS = 80

const SILENCE_WINDOW_MS = 100
const SILENCE_DB_THRESHOLD = -50
const SILENCE_MIN_DURATION_MS = 1000
const SILENCE_EDGE_IGNORE_RATIO = 0.05
const SILENCE_MERGE_GAP_MS = 300

const LOW_DYNAMICS_CREST_DB = 6

// ────────────────────────────────────────────────────────────────────────────
// Frequency-domain thresholds (Phase 3)
// ────────────────────────────────────────────────────────────────────────────

const FFT_SIZE = 4096 // ~93 ms window at 44.1 kHz; ~10.8 Hz bin resolution
const HOP_SIZE = 2048 // 50 % overlap

const BAND_RANGES_HZ = {
  sub: [20, 80],
  bass: [80, 250],
  lowMids: [250, 500],
  mids: [500, 2000],
  upperMids: [2000, 4000],
  presence: [4000, 8000],
  brilliance: [8000, 16000],
} as const

const MUDDY_DELTA_DB = 3
const HARSH_DELTA_DB = 3
const WEAK_LOW_END_DELTA_DB = -9
const DULL_DELTA_DB = -12

const SECTION_DURATION_S = 4
const GLOBAL_ISSUE_RATIO = 0.7
const MIN_LOCAL_SECTIONS = 2

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function amplitudeToDb(amp: number): number {
  if (amp <= 0) return -Infinity
  return 20 * Math.log10(amp)
}

function mergeNearbyIssues(issues: AnalysisIssue[], gapSeconds: number): AnalysisIssue[] {
  if (issues.length === 0) return issues
  const sorted = [...issues].sort((a, b) => a.start - b.start)
  const merged: AnalysisIssue[] = []
  let current = { ...sorted[0] }
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    if (next.kind === current.kind && next.start - current.end <= gapSeconds) {
      current.end = Math.max(current.end, next.end)
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  return merged
}

// ────────────────────────────────────────────────────────────────────────────
// Time-domain detectors
// ────────────────────────────────────────────────────────────────────────────

function detectClipping(pcm: Float32Array, sampleRate: number): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []
  const minSamples = Math.max(3, Math.floor((sampleRate * MIN_CLIP_DURATION_MS) / 1000))

  let runStart = -1
  let runLength = 0
  const push = (endSample: number) => {
    if (runStart !== -1 && runLength >= minSamples) {
      issues.push({
        id: `clip-${runStart}`,
        kind: 'clipping',
        severity: 'critical',
        scope: 'local',
        start: runStart / sampleRate,
        end: endSample / sampleRate,
        title: 'Clipping detectado',
        suggestion:
          'Aquí el audio supera 0 dBFS y produce distorsión digital. Baja la ganancia general o coloca un limitador antes del master.',
      })
    }
    runStart = -1
    runLength = 0
  }
  for (let i = 0; i < pcm.length; i++) {
    if (Math.abs(pcm[i]) >= CLIP_THRESHOLD) {
      if (runStart === -1) runStart = i
      runLength++
    } else if (runStart !== -1) {
      push(i)
    }
  }
  push(pcm.length)

  return mergeNearbyIssues(issues, MERGE_GAP_MS / 1000)
}

function detectLoudPeaks(pcm: Float32Array, sampleRate: number): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []
  const windowSamples = Math.max(1, Math.floor((sampleRate * LOUD_PEAK_WINDOW_MS) / 1000))

  let runStart = -1
  let runEnd = -1
  const flush = () => {
    if (runStart === -1) return
    const durationMs = ((runEnd - runStart) / sampleRate) * 1000
    if (durationMs >= LOUD_PEAK_MIN_DURATION_MS) {
      issues.push({
        id: `peak-${runStart}`,
        kind: 'loud-peak',
        severity: 'warning',
        scope: 'local',
        start: runStart / sampleRate,
        end: runEnd / sampleRate,
        title: 'Pico cercano al clipping',
        suggestion:
          'Hay picos por encima de -1 dBFS aquí. Aún no es clipping, pero deja muy poco headroom — un compresor encadenado o un sistema con loudness normalization puede empujarlo al rojo.',
      })
    }
    runStart = -1
    runEnd = -1
  }
  for (let i = 0; i < pcm.length; i += windowSamples) {
    const end = Math.min(i + windowSamples, pcm.length)
    let maxAbs = 0
    for (let j = i; j < end; j++) {
      const abs = Math.abs(pcm[j])
      if (abs > maxAbs) maxAbs = abs
    }
    if (maxAbs >= LOUD_PEAK_THRESHOLD && maxAbs < CLIP_THRESHOLD) {
      if (runStart === -1) runStart = i
      runEnd = end
    } else {
      flush()
    }
  }
  flush()
  return mergeNearbyIssues(issues, MERGE_GAP_MS / 1000)
}

function detectSilence(pcm: Float32Array, sampleRate: number): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []
  const windowSamples = Math.max(1, Math.floor((sampleRate * SILENCE_WINDOW_MS) / 1000))
  const ignoreStart = pcm.length * SILENCE_EDGE_IGNORE_RATIO
  const ignoreEnd = pcm.length * (1 - SILENCE_EDGE_IGNORE_RATIO)

  let runStart = -1
  let runEnd = -1
  const flush = () => {
    if (runStart === -1) return
    const isInternal = runStart >= ignoreStart && runEnd <= ignoreEnd
    const durationMs = ((runEnd - runStart) / sampleRate) * 1000
    if (isInternal && durationMs >= SILENCE_MIN_DURATION_MS) {
      const startSec = runStart / sampleRate
      const endSec = runEnd / sampleRate
      issues.push({
        id: `silence-${runStart}`,
        kind: 'silence',
        severity: 'warning',
        scope: 'local',
        start: startSec,
        end: endSec,
        title: `Silencio inesperado (${(endSec - startSec).toFixed(1)}s)`,
        suggestion:
          'Aquí hay un tramo silencioso en mitad de la pista. ¿Es intencional o un fade/mute accidental? Revisa si quieres rellenarlo o acortarlo.',
      })
    }
    runStart = -1
    runEnd = -1
  }
  for (let i = 0; i < pcm.length; i += windowSamples) {
    const end = Math.min(i + windowSamples, pcm.length)
    let sumSquares = 0
    for (let j = i; j < end; j++) {
      sumSquares += pcm[j] * pcm[j]
    }
    const count = end - i
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0
    if (amplitudeToDb(rms) < SILENCE_DB_THRESHOLD) {
      if (runStart === -1) runStart = i
      runEnd = end
    } else {
      flush()
    }
  }
  flush()
  return mergeNearbyIssues(issues, SILENCE_MERGE_GAP_MS / 1000)
}

function detectLowDynamics(metrics: AnalysisMetrics, duration: number): AnalysisIssue[] {
  if (!Number.isFinite(metrics.crestFactorDb)) return []
  if (metrics.crestFactorDb >= LOW_DYNAMICS_CREST_DB) return []
  const anchor = Number.isFinite(metrics.peakAt) ? metrics.peakAt : duration / 2
  return [
    {
      id: 'low-dynamics',
      kind: 'low-dynamics',
      severity: 'warning',
      scope: 'global',
      start: 0,
      end: duration,
      commentAt: anchor,
      title: `Dinámica baja (crest ${metrics.crestFactorDb.toFixed(1)} dB)`,
      suggestion: `La mezcla está muy comprimida (crest factor ${metrics.crestFactorDb.toFixed(
        1,
      )} dB; lo sano es 8–14 dB). Suena "aplastada" y cansa al oído rápido. Considera bajar la ganancia del limitador del master o quitar compresión en el bus principal.`,
    },
  ]
}

function computeMetrics(pcm: Float32Array, sampleRate: number): AnalysisMetrics {
  let peakAbs = 0
  let peakIndex = 0
  let sumSquares = 0
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]
    const abs = v < 0 ? -v : v
    if (abs > peakAbs) {
      peakAbs = abs
      peakIndex = i
    }
    sumSquares += v * v
  }
  const rms = pcm.length > 0 ? Math.sqrt(sumSquares / pcm.length) : 0
  const peakDb = amplitudeToDb(peakAbs)
  const rmsDb = amplitudeToDb(rms)
  return {
    peakDb,
    rmsDb,
    peakAt: peakIndex / sampleRate,
    crestFactorDb: Number.isFinite(peakDb) && Number.isFinite(rmsDb) ? peakDb - rmsDb : 0,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// FFT (in-place Cooley-Tukey radix-2)
// ────────────────────────────────────────────────────────────────────────────

function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = real[i]
      real[i] = real[j]
      real[j] = t
      t = imag[i]
      imag[i] = imag[j]
      imag[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1
    const angleStep = (-2 * Math.PI) / len
    const wStepReal = Math.cos(angleStep)
    const wStepImag = Math.sin(angleStep)
    for (let i = 0; i < n; i += len) {
      let wReal = 1
      let wImag = 0
      for (let k = 0; k < halfLen; k++) {
        const aReal = real[i + k]
        const aImag = imag[i + k]
        const bReal = real[i + k + halfLen] * wReal - imag[i + k + halfLen] * wImag
        const bImag = real[i + k + halfLen] * wImag + imag[i + k + halfLen] * wReal
        real[i + k] = aReal + bReal
        imag[i + k] = aImag + bImag
        real[i + k + halfLen] = aReal - bReal
        imag[i + k + halfLen] = aImag - bImag
        const newWReal = wReal * wStepReal - wImag * wStepImag
        wImag = wReal * wStepImag + wImag * wStepReal
        wReal = newWReal
      }
    }
  }
}

function buildHannWindow(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
  }
  return w
}

interface BandBins {
  sub: [number, number]
  bass: [number, number]
  lowMids: [number, number]
  mids: [number, number]
  upperMids: [number, number]
  presence: [number, number]
  brilliance: [number, number]
}

function bandsToBins(sampleRate: number, fftSize: number): BandBins {
  const binHz = sampleRate / fftSize
  const map = (lo: number, hi: number): [number, number] => [
    Math.max(0, Math.floor(lo / binHz)),
    Math.min(fftSize / 2 - 1, Math.ceil(hi / binHz)),
  ]
  return {
    sub: map(BAND_RANGES_HZ.sub[0], BAND_RANGES_HZ.sub[1]),
    bass: map(BAND_RANGES_HZ.bass[0], BAND_RANGES_HZ.bass[1]),
    lowMids: map(BAND_RANGES_HZ.lowMids[0], BAND_RANGES_HZ.lowMids[1]),
    mids: map(BAND_RANGES_HZ.mids[0], BAND_RANGES_HZ.mids[1]),
    upperMids: map(BAND_RANGES_HZ.upperMids[0], BAND_RANGES_HZ.upperMids[1]),
    presence: map(BAND_RANGES_HZ.presence[0], BAND_RANGES_HZ.presence[1]),
    brilliance: map(BAND_RANGES_HZ.brilliance[0], BAND_RANGES_HZ.brilliance[1]),
  }
}

interface Section {
  startSec: number
  endSec: number
  bands: BandEnergies
}

function computeSections(pcm: Float32Array, sampleRate: number): Section[] {
  const window = buildHannWindow(FFT_SIZE)
  const bins = bandsToBins(sampleRate, FFT_SIZE)
  const bandKeys = Object.keys(bins) as (keyof BandBins)[]
  const counts: Record<keyof BandBins, number> = {
    sub: bins.sub[1] - bins.sub[0] + 1,
    bass: bins.bass[1] - bins.bass[0] + 1,
    lowMids: bins.lowMids[1] - bins.lowMids[0] + 1,
    mids: bins.mids[1] - bins.mids[0] + 1,
    upperMids: bins.upperMids[1] - bins.upperMids[0] + 1,
    presence: bins.presence[1] - bins.presence[0] + 1,
    brilliance: bins.brilliance[1] - bins.brilliance[0] + 1,
  }

  const sectionSamples = Math.max(FFT_SIZE, Math.floor(sampleRate * SECTION_DURATION_S))
  const real = new Float32Array(FFT_SIZE)
  const imag = new Float32Array(FFT_SIZE)
  const sections: Section[] = []

  for (let secStart = 0; secStart < pcm.length; secStart += sectionSamples) {
    const secEnd = Math.min(secStart + sectionSamples, pcm.length)
    if (secEnd - secStart < FFT_SIZE) break

    const sums: Record<keyof BandBins, number> = {
      sub: 0,
      bass: 0,
      lowMids: 0,
      mids: 0,
      upperMids: 0,
      presence: 0,
      brilliance: 0,
    }
    let frames = 0
    for (let start = secStart; start + FFT_SIZE <= secEnd; start += HOP_SIZE) {
      for (let i = 0; i < FFT_SIZE; i++) {
        real[i] = pcm[start + i] * window[i]
        imag[i] = 0
      }
      fft(real, imag)
      for (const key of bandKeys) {
        const [lo, hi] = bins[key]
        let acc = 0
        for (let k = lo; k <= hi; k++) {
          acc += real[k] * real[k] + imag[k] * imag[k]
        }
        sums[key] += acc
      }
      frames++
    }

    const bandsDb = (key: keyof BandBins): number => {
      if (frames === 0 || counts[key] === 0) return -Infinity
      const meanPower = sums[key] / frames / counts[key]
      if (meanPower <= 0) return -Infinity
      return 10 * Math.log10(meanPower)
    }

    sections.push({
      startSec: secStart / sampleRate,
      endSec: secEnd / sampleRate,
      bands: {
        sub: bandsDb('sub'),
        bass: bandsDb('bass'),
        lowMids: bandsDb('lowMids'),
        mids: bandsDb('mids'),
        upperMids: bandsDb('upperMids'),
        presence: bandsDb('presence'),
        brilliance: bandsDb('brilliance'),
      },
    })
  }

  return sections
}

function averageBands(sections: Section[]): BandEnergies {
  if (sections.length === 0) {
    return {
      sub: -Infinity,
      bass: -Infinity,
      lowMids: -Infinity,
      mids: -Infinity,
      upperMids: -Infinity,
      presence: -Infinity,
      brilliance: -Infinity,
    }
  }
  const keys: (keyof BandEnergies)[] = [
    'sub',
    'bass',
    'lowMids',
    'mids',
    'upperMids',
    'presence',
    'brilliance',
  ]
  const out: Partial<BandEnergies> = {}
  for (const key of keys) {
    let sum = 0
    let n = 0
    for (const s of sections) {
      const v = s.bands[key]
      if (Number.isFinite(v)) {
        sum += v
        n++
      }
    }
    out[key] = n > 0 ? sum / n : -Infinity
  }
  return out as BandEnergies
}

interface SpectralCheck {
  kind: 'muddy' | 'harsh' | 'weak-low-end' | 'dull'
  test: (b: BandEnergies) => number | null
  title: string
  globalSuggestion: string
  localSuggestion: (startSec: number, endSec: number) => string
}

const SPECTRAL_CHECKS: SpectralCheck[] = [
  {
    kind: 'muddy',
    test: (b) =>
      Number.isFinite(b.lowMids) && Number.isFinite(b.mids) && b.lowMids - b.mids >= MUDDY_DELTA_DB
        ? b.lowMids - b.mids
        : null,
    title: 'Mezcla turbia',
    globalSuggestion:
      'Las frecuencias 250–500 Hz dominan toda la mezcla. Suelen acumular energía de bajos, voces y guitarras solapándose. Prueba un corte de 2–3 dB con un EQ amplio centrado en 300 Hz en el bus general.',
    localSuggestion: () =>
      'En este tramo la mezcla se vuelve turbia: las frecuencias 250–500 Hz se acumulan. Probablemente bajos + voces o pads se están solapando aquí. Considera EQ dinámico, sidechain o automatización del corte de low-mids.',
  },
  {
    kind: 'harsh',
    test: (b) =>
      Number.isFinite(b.presence) && Number.isFinite(b.mids) && b.presence - b.mids >= HARSH_DELTA_DB
        ? b.presence - b.mids
        : null,
    title: 'Harshness en agudos',
    globalSuggestion:
      'Hay exceso de energía en 4–8 kHz durante toda la pista. Cansa al oído. Revisa sibilancias en voces (de-esser) y exceso de brillo en hi-hats / platos.',
    localSuggestion: () =>
      'En este tramo los agudos 4–8 kHz se vuelven agresivos. Si es una voz, mete un de-esser dinámico aquí. Si es un platillo / charles, baja un par de dB con automatización.',
  },
  {
    kind: 'weak-low-end',
    test: (b) =>
      Number.isFinite(b.bass) && Number.isFinite(b.mids) && b.bass - b.mids <= WEAK_LOW_END_DELTA_DB
        ? b.bass - b.mids
        : null,
    title: 'Bajos débiles',
    globalSuggestion:
      'Toda la pista tiene la zona 80–250 Hz muy por debajo de los medios. Sonará "delgada" en altavoces grandes. Refuerza bombo/bajo o usa un shelf grave en el master.',
    localSuggestion: () =>
      'En este tramo desaparecen los bajos. Probablemente hay un break o un drop con menos instrumentación. Si no es intencional, revisa si has muteado/atenuado el bajo o el bombo aquí.',
  },
  {
    kind: 'dull',
    test: (b) =>
      Number.isFinite(b.brilliance) &&
      Number.isFinite(b.mids) &&
      b.brilliance - b.mids <= DULL_DELTA_DB
        ? b.brilliance - b.mids
        : null,
    title: 'Falta de brillo',
    globalSuggestion:
      'Las frecuencias por encima de 8 kHz están muy bajas en toda la pista. Sonará apagada o "tapada". Prueba un shelf agudo suave o un exciter armónico en el master.',
    localSuggestion: () =>
      'En este tramo se pierden los agudos. Puede ser un cambio de sección intencionado (verso más íntimo) o un mute accidental de platos / aire. Revísalo.',
  },
]

interface ContiguousRun {
  startIdx: number
  endIdx: number
  maxDelta: number
}

function groupContiguous(flagged: { idx: number; delta: number }[]): ContiguousRun[] {
  if (flagged.length === 0) return []
  const groups: ContiguousRun[] = []
  let current: ContiguousRun = {
    startIdx: flagged[0].idx,
    endIdx: flagged[0].idx,
    maxDelta: flagged[0].delta,
  }
  for (let i = 1; i < flagged.length; i++) {
    const { idx, delta } = flagged[i]
    if (idx === current.endIdx + 1) {
      current.endIdx = idx
      if (Math.abs(delta) > Math.abs(current.maxDelta)) current.maxDelta = delta
    } else {
      groups.push(current)
      current = { startIdx: idx, endIdx: idx, maxDelta: delta }
    }
  }
  groups.push(current)
  return groups
}

function detectFrequencyIssues(
  sections: Section[],
  duration: number,
  metrics: AnalysisMetrics,
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []
  if (sections.length === 0) return issues
  const anchor = Number.isFinite(metrics.peakAt) ? metrics.peakAt : duration / 2

  for (const check of SPECTRAL_CHECKS) {
    const flagged: { idx: number; delta: number }[] = []
    for (let i = 0; i < sections.length; i++) {
      const delta = check.test(sections[i].bands)
      if (delta !== null) flagged.push({ idx: i, delta })
    }
    if (flagged.length === 0) continue

    const ratio = flagged.length / sections.length

    if (ratio >= GLOBAL_ISSUE_RATIO) {
      const avgDelta = flagged.reduce((s, f) => s + f.delta, 0) / flagged.length
      issues.push({
        id: `${check.kind}-global`,
        kind: check.kind,
        severity: 'warning',
        scope: 'global',
        start: 0,
        end: duration,
        commentAt: anchor,
        title: `${check.title} (${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(1)} dB)`,
        suggestion: check.globalSuggestion,
      })
      continue
    }

    const runs = groupContiguous(flagged)
    for (const run of runs) {
      const sectionsInRun = run.endIdx - run.startIdx + 1
      if (sectionsInRun < MIN_LOCAL_SECTIONS) continue
      const startSec = sections[run.startIdx].startSec
      const endSec = sections[run.endIdx].endSec
      const lengthSec = endSec - startSec
      issues.push({
        id: `${check.kind}-${run.startIdx}`,
        kind: check.kind,
        severity: 'warning',
        scope: 'local',
        start: startSec,
        end: endSec,
        title: `${check.title} (${lengthSec.toFixed(0)}s, ${run.maxDelta >= 0 ? '+' : ''}${run.maxDelta.toFixed(1)} dB)`,
        suggestion: check.localSuggestion(startSec, endSec),
      })
    }
  }

  return issues
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────────

function runAnalysis(pcm: Float32Array, sampleRate: number, duration: number): AnalysisResult {
  const metrics = computeMetrics(pcm, sampleRate)
  const sections = computeSections(pcm, sampleRate)
  metrics.bands = averageBands(sections)

  const issues = [
    ...detectClipping(pcm, sampleRate),
    ...detectLoudPeaks(pcm, sampleRate),
    ...detectSilence(pcm, sampleRate),
    ...detectLowDynamics(metrics, duration),
    ...detectFrequencyIssues(sections, duration, metrics),
  ].sort((a, b) => a.start - b.start)

  return { issues, duration, sampleRate, metrics }
}

/**
 * `Infinity` / `-Infinity` survive JSON.stringify as `null`, which makes the
 * client side guards (`Number.isFinite(...)`) misread the data as "present
 * but invalid" rather than "absent". We sanitize once before persisting:
 * `-Infinity` becomes `null`, finite numbers stay numbers.
 */
function sanitizeMetrics(metrics: AnalysisMetrics): AnalysisMetrics {
  const sanitizeBand = (v: number): number => (Number.isFinite(v) ? v : -Infinity)
  return {
    peakDb: Number.isFinite(metrics.peakDb) ? metrics.peakDb : -Infinity,
    rmsDb: Number.isFinite(metrics.rmsDb) ? metrics.rmsDb : -Infinity,
    peakAt: Number.isFinite(metrics.peakAt) ? metrics.peakAt : 0,
    crestFactorDb: Number.isFinite(metrics.crestFactorDb) ? metrics.crestFactorDb : 0,
    bands: metrics.bands
      ? {
          sub: sanitizeBand(metrics.bands.sub),
          bass: sanitizeBand(metrics.bands.bass),
          lowMids: sanitizeBand(metrics.bands.lowMids),
          mids: sanitizeBand(metrics.bands.mids),
          upperMids: sanitizeBand(metrics.bands.upperMids),
          presence: sanitizeBand(metrics.bands.presence),
          brilliance: sanitizeBand(metrics.bands.brilliance),
        }
      : undefined,
  }
}

/**
 * Replace non-finite numbers with `null` so the result survives a Prisma
 * `Json` round-trip without becoming `null` silently. Postgres' JSON spec
 * doesn't allow `Infinity` / `NaN`; we lose the sign of the infinity but
 * the client only needs `Number.isFinite()` to make decisions, so the loss
 * is harmless.
 */
export function serializeAnalysisForDb(result: AnalysisResult): unknown {
  const replacer = (_key: string, value: unknown) =>
    typeof value === 'number' && !Number.isFinite(value) ? null : value
  return JSON.parse(JSON.stringify(result, replacer))
}

/**
 * Decode an uploaded audio file ONCE, then derive both the waveform peaks
 * and the full analysis (metrics + issues) from the same in-memory samples.
 * Decoding is by far the most expensive step, so doing it twice would
 * roughly double the upload latency.
 *
 * Analysis failures are non-fatal: peaks still come back, `analysis` is
 * `null`, and the client falls back to "Sin análisis disponible".
 */
export async function processAudioBuffer(
  bytes: Buffer | ArrayBuffer | Uint8Array,
): Promise<ProcessedAudio> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer)
  let audio: DecodedAudio
  try {
    audio = (await decode(input)) as DecodedAudio
  } catch (err) {
    console.error('[audio-processing] decode failed:', err)
    return { peaks: [], duration: 0, sampleRate: 0, analysis: null }
  }

  const peaks = computePeaks(audio, PEAKS_BIN_COUNT)
  const sampleRate = audio.sampleRate
  const samples = audio.channelData[0]?.length ?? 0
  const duration = sampleRate > 0 ? samples / sampleRate : 0

  let analysis: AnalysisResult | null = null
  try {
    const pcm = toMonoPcm(audio)
    const raw = runAnalysis(pcm, sampleRate, duration)
    analysis = { ...raw, metrics: sanitizeMetrics(raw.metrics) }
  } catch (err) {
    console.error('[audio-processing] analysis failed:', err)
  }

  return { peaks, duration, sampleRate, analysis }
}
