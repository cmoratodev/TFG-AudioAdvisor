import type { UserLevel } from '@prisma/client'

export interface TrackVersionSummary {
  id: string
  versionNumber: number
  audioUrl: string
  duration: number
  createdAt: number
  /**
   * Pre-computed normalized waveform peaks (one per visual bin). Empty for
   * legacy versions whose backfill hasn't run yet — the client should then
   * fall back to a flat placeholder rather than fetching the audio.
   */
  peaks: number[]
}

export interface TrackData {
  id: string
  title: string
  author: string
  audioUrl: string
  coverUrl?: string
  /** Total duration in seconds. Optional until audio metadata loads. */
  duration?: number
  /** Genre tag (used in Explore filters). */
  genre?: string
  /** Author rank (when known). */
  authorLevel?: UserLevel
  /** Author user id (used to link to /profile/[id]). */
  authorId?: string
}

export interface CommentEntry {
  id: string
  content: string
  /** Timestamp in seconds from the beginning of the track. */
  timestamp: number
  author: string
  authorId: string
  authorLevel: UserLevel
  createdAt: number
  /** Votes count for this comment. */
  votes: number
  /** Whether the viewing user (typically the track owner) already marked it useful. */
  votedByViewer: boolean
  /** Single-level replies. Only present on top-level comments. */
  replies?: CommentEntry[]
}

export type RepeatMode = 'off' | 'all' | 'one'
