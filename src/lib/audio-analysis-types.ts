/**
 * Pure types for the audio analysis pipeline.
 *
 * This file MUST stay importable from both the server (where the analysis
 * runs at upload time) and the client (where the results are rendered). No
 * runtime code lives here — only types — so it never drags Node-only or
 * browser-only modules into the wrong bundle.
 */

export type IssueSeverity = 'critical' | 'warning'

export type IssueKind =
  | 'clipping'
  | 'loud-peak'
  | 'silence'
  | 'low-dynamics'
  | 'muddy'
  | 'harsh'
  | 'weak-low-end'
  | 'dull'

export interface AnalysisIssue {
  id: string
  kind: IssueKind
  severity: IssueSeverity
  /**
   * Whether the issue affects a specific moment (`local`) or the entire track
   * (`global`). Drives how the panel renders the time chip and where the
   * comment draft is anchored.
   */
  scope: 'local' | 'global'
  /** Start timestamp in seconds. */
  start: number
  /** End timestamp in seconds (exclusive). */
  end: number
  /**
   * Where to drop the comment marker when the user clicks "Comentar".
   * Defaults to `start` if omitted. For global issues this is set to a
   * representative point (typically the loudest moment).
   */
  commentAt?: number
  title: string
  /** Pre-built Spanish suggestion shown when the user opens the comment draft. */
  suggestion: string
}

/** Average energy per frequency band in dB (mean across all STFT frames). */
export interface BandEnergies {
  /** 20–80 Hz */
  sub: number
  /** 80–250 Hz */
  bass: number
  /** 250–500 Hz */
  lowMids: number
  /** 500–2000 Hz */
  mids: number
  /** 2000–4000 Hz */
  upperMids: number
  /** 4000–8000 Hz */
  presence: number
  /** 8000–16000 Hz */
  brilliance: number
}

export interface AnalysisMetrics {
  /** Maximum absolute amplitude across the whole track, in dBFS. */
  peakDb: number
  /** Root-mean-square loudness across the whole track, in dBFS. */
  rmsDb: number
  /** Timestamp (s) of the single loudest sample. */
  peakAt: number
  /** Crest factor in dB (peak − RMS). */
  crestFactorDb: number
  /** Per-band average energy. Undefined if FFT analysis was skipped. */
  bands?: BandEnergies
}

export interface AnalysisResult {
  issues: AnalysisIssue[]
  /** Duration of the analyzed audio in seconds. */
  duration: number
  /** Sample rate (Hz) reported by the decoder. */
  sampleRate: number
  metrics: AnalysisMetrics
}
